import type { DurationLikeObject } from 'luxon';
import { Duration } from 'luxon';
import { z } from 'zod';

export const ZEnvelopeReminderDurationPeriod = z
  .object({
    unit: z.enum(['day', 'week', 'month']),
    amount: z.number().int().min(1),
  })
  .superRefine((period, ctx) => {
    if (getEnvelopeReminderDuration(period).toMillis() > MAX_REMINDER_PERIOD_DAYS * 86_400_000) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Period must not exceed ${MAX_REMINDER_PERIOD_DAYS} days.`,
      });
    }
  });

export const ZEnvelopeReminderDisabledPeriod = z.object({
  disabled: z.literal(true),
});

export const ZEnvelopeReminderPeriod = z.union([ZEnvelopeReminderDurationPeriod, ZEnvelopeReminderDisabledPeriod]);

export type TEnvelopeReminderPeriod = z.infer<typeof ZEnvelopeReminderPeriod>;
export type TEnvelopeReminderDurationPeriod = z.infer<typeof ZEnvelopeReminderDurationPeriod>;

export const ZEnvelopeReminderSettingsShape = z.object({
  sendAfter: ZEnvelopeReminderPeriod,
  repeatEvery: ZEnvelopeReminderPeriod,
  /**
   * How long after `sentAt` automated reminders may keep being sent.
   * Optional for backwards compatibility with settings saved before this
   * field existed - `resolveNextReminderAt` falls back to
   * `MAX_REMINDER_WINDOW_DAYS` when absent, so old records keep behaving
   * exactly as they did before.
   */
  stopAfter: ZEnvelopeReminderDurationPeriod.optional(),
});

export const STOP_AFTER_TOO_SHORT_MESSAGE = 'Stop-after period must be at least as long as the first-reminder delay.';

/**
 * Whether `stopAfter` is long enough that the first reminder (`sendAfter`)
 * would actually be allowed to fire. Returns true (valid) when `stopAfter`
 * is unset or `sendAfter` is disabled, since there's nothing to compare
 * against in either case. Shared by the schema-level validation below and
 * by `ReminderSettingsPicker`'s inline warning, so both stay in sync.
 */
export const isStopAfterAtLeastSendAfter = (
  sendAfter: TEnvelopeReminderPeriod,
  stopAfter: TEnvelopeReminderDurationPeriod | undefined,
): boolean => {
  if (!stopAfter || 'disabled' in sendAfter) {
    return true;
  }

  return getEnvelopeReminderDuration(stopAfter).toMillis() >= getEnvelopeReminderDuration(sendAfter).toMillis();
};

export const ZEnvelopeReminderSettings = ZEnvelopeReminderSettingsShape.superRefine((settings, ctx) => {
  if (!isStopAfterAtLeastSendAfter(settings.sendAfter, settings.stopAfter)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['stopAfter'],
      message: STOP_AFTER_TOO_SHORT_MESSAGE,
    });
  }
});

export type TEnvelopeReminderSettings = z.infer<typeof ZEnvelopeReminderSettingsShape>;

export const DEFAULT_ENVELOPE_REMINDER_SETTINGS: TEnvelopeReminderSettings = {
  sendAfter: { unit: 'day', amount: 5 },
  repeatEvery: { unit: 'day', amount: 2 },
  stopAfter: { unit: 'day', amount: 30 },
};

/**
 * Default window in which automated reminders may be sent, measured from
 * the moment the signing request was first sent to the recipient, used
 * whenever a config doesn't specify its own `stopAfter`. Configurable
 * per-organisation/team/document via `stopAfter`; this is only the
 * fallback for settings saved before that field existed. Prevents runaway
 * reminder chains for recipients with no expiration set who never sign.
 */
export const MAX_REMINDER_WINDOW_DAYS = 30;

/**
 * Maximum number of automated reminders sent to a recipient before reminders
 * stop. A manual resend resets the count, re-arming reminders.
 */
export const MAX_REMINDERS_BEFORE_RESEND = 5;

/**
 * Absolute ceiling on any single `sendAfter`/`repeatEvery`/`stopAfter`
 * period, regardless of unit. Without this, a sufficiently large `amount`
 * (e.g. hundreds of millions of days) overflows `Date` arithmetic to
 * `Invalid Date`, which would make every downstream comparison silently
 * resolve to `false` and defeat the reminder cap entirely instead of
 * erroring. 10 years comfortably covers any realistic configuration.
 */
export const MAX_REMINDER_PERIOD_DAYS = 3650;

const UNIT_TO_LUXON_KEY: Record<TEnvelopeReminderDurationPeriod['unit'], keyof DurationLikeObject> = {
  day: 'days',
  week: 'weeks',
  month: 'months',
};

export const getEnvelopeReminderDuration = (period: TEnvelopeReminderDurationPeriod): Duration => {
  return Duration.fromObject({ [UNIT_TO_LUXON_KEY[period.unit]]: period.amount });
};

/**
 * Resolve the next reminder timestamp from the config and the last reminder sent time.
 *
 * - `null` config means reminders are disabled (inherit = no override, resolved as disabled).
 * - `{ sendAfter: { disabled: true }, ... }` means never send the first reminder.
 * - `{ repeatEvery: { disabled: true }, ... }` means don't repeat after the first reminder.
 *
 * Reminders stop (returns null) once either cap is hit: `config.stopAfter`
 * (falling back to `MAX_REMINDER_WINDOW_DAYS` when unset) from `sentAt`, or
 * `MAX_REMINDERS_BEFORE_RESEND` reminders already sent.
 *
 * `sentAt` is when the signing request was sent to this specific recipient.
 *
 * Returns the next Date the reminder should be sent, or null if none.
 */
export const resolveNextReminderAt = (options: {
  config: TEnvelopeReminderSettings | null;
  sentAt: Date;
  lastReminderSentAt: Date | null;
  reminderCount: number;
}): Date | null => {
  const { config, sentAt, lastReminderSentAt, reminderCount } = options;

  if (!config) {
    return null;
  }

  if (reminderCount >= MAX_REMINDERS_BEFORE_RESEND) {
    return null;
  }

  const stopAfterDuration = config.stopAfter
    ? getEnvelopeReminderDuration(config.stopAfter)
    : Duration.fromObject({ days: MAX_REMINDER_WINDOW_DAYS });

  const maxReminderAt = new Date(sentAt.getTime() + stopAfterDuration.toMillis());

  let candidate: Date;

  // If we haven't sent the first reminder yet, use sendAfter.
  if (!lastReminderSentAt) {
    if ('disabled' in config.sendAfter) {
      return null;
    }

    const delay = getEnvelopeReminderDuration(config.sendAfter);

    candidate = new Date(sentAt.getTime() + delay.toMillis());
  } else {
    // For subsequent reminders, use repeatEvery.
    if ('disabled' in config.repeatEvery) {
      return null;
    }

    const interval = getEnvelopeReminderDuration(config.repeatEvery);

    candidate = new Date(lastReminderSentAt.getTime() + interval.toMillis());
  }

  // Stop if the candidate is past the hard cap measured from sentAt.
  if (candidate.getTime() > maxReminderAt.getTime()) {
    return null;
  }

  return candidate;
};
