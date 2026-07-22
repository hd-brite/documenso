import { describe, expect, it } from 'vitest';

import {
  isStopAfterAtLeastSendAfter,
  MAX_REMINDER_PERIOD_DAYS,
  MAX_REMINDER_WINDOW_DAYS,
  MAX_REMINDERS_BEFORE_RESEND,
  resolveNextReminderAt,
  ZEnvelopeReminderSettings,
} from './envelope-reminder';

const SENT_AT = new Date('2026-01-01T00:00:00.000Z');

describe('resolveNextReminderAt', () => {
  it('falls back to the MAX_REMINDER_WINDOW_DAYS default when stopAfter is absent', () => {
    const config = ZEnvelopeReminderSettings.parse({
      sendAfter: { unit: 'day', amount: 5 },
      repeatEvery: { unit: 'day', amount: 2 },
    });

    // Last reminder sent such that the next repeatEvery (2 days) still lands within the 30-day default window.
    const lastReminderSentAt = new Date(SENT_AT.getTime() + (MAX_REMINDER_WINDOW_DAYS - 3) * 86_400_000);

    const next = resolveNextReminderAt({
      config,
      sentAt: SENT_AT,
      lastReminderSentAt,
      reminderCount: 1,
    });

    expect(next).not.toBeNull();

    // One more repeatEvery (2 days) pushes past the 30-day default window.
    const lastReminderPastWindow = new Date(SENT_AT.getTime() + MAX_REMINDER_WINDOW_DAYS * 86_400_000);

    expect(
      resolveNextReminderAt({
        config,
        sentAt: SENT_AT,
        lastReminderSentAt: lastReminderPastWindow,
        reminderCount: 1,
      }),
    ).toBeNull();
  });

  it('cuts reminders off earlier when stopAfter is shorter than the default', () => {
    const config = ZEnvelopeReminderSettings.parse({
      sendAfter: { unit: 'day', amount: 1 },
      repeatEvery: { unit: 'day', amount: 1 },
      stopAfter: { unit: 'day', amount: 3 },
    });

    const withinWindow = resolveNextReminderAt({
      config,
      sentAt: SENT_AT,
      lastReminderSentAt: new Date(SENT_AT.getTime() + 2 * 86_400_000),
      reminderCount: 1,
    });

    expect(withinWindow).not.toBeNull();

    const pastWindow = resolveNextReminderAt({
      config,
      sentAt: SENT_AT,
      lastReminderSentAt: new Date(SENT_AT.getTime() + 3 * 86_400_000),
      reminderCount: 1,
    });

    expect(pastWindow).toBeNull();
  });

  it('allows reminders later than the 30-day default when stopAfter is longer', () => {
    const config = ZEnvelopeReminderSettings.parse({
      sendAfter: { unit: 'day', amount: 5 },
      repeatEvery: { unit: 'day', amount: 2 },
      stopAfter: { unit: 'day', amount: 45 },
    });

    const beyondDefaultWindow = resolveNextReminderAt({
      config,
      sentAt: SENT_AT,
      lastReminderSentAt: new Date(SENT_AT.getTime() + 40 * 86_400_000),
      reminderCount: 1,
    });

    expect(beyondDefaultWindow).not.toBeNull();

    const beyondCustomWindow = resolveNextReminderAt({
      config,
      sentAt: SENT_AT,
      lastReminderSentAt: new Date(SENT_AT.getTime() + 45 * 86_400_000),
      reminderCount: 1,
    });

    expect(beyondCustomWindow).toBeNull();
  });

  it('converts stopAfter expressed in weeks and months correctly', () => {
    const weekConfig = ZEnvelopeReminderSettings.parse({
      sendAfter: { unit: 'day', amount: 1 },
      repeatEvery: { unit: 'day', amount: 1 },
      stopAfter: { unit: 'week', amount: 2 },
    });

    expect(
      resolveNextReminderAt({
        config: weekConfig,
        sentAt: SENT_AT,
        lastReminderSentAt: new Date(SENT_AT.getTime() + 13 * 86_400_000),
        reminderCount: 1,
      }),
    ).not.toBeNull();

    expect(
      resolveNextReminderAt({
        config: weekConfig,
        sentAt: SENT_AT,
        lastReminderSentAt: new Date(SENT_AT.getTime() + 14 * 86_400_000),
        reminderCount: 1,
      }),
    ).toBeNull();

    const monthConfig = ZEnvelopeReminderSettings.parse({
      sendAfter: { unit: 'day', amount: 1 },
      repeatEvery: { unit: 'day', amount: 1 },
      stopAfter: { unit: 'month', amount: 1 },
    });

    expect(
      resolveNextReminderAt({
        config: monthConfig,
        sentAt: SENT_AT,
        lastReminderSentAt: new Date(SENT_AT.getTime() + 27 * 86_400_000),
        reminderCount: 1,
      }),
    ).not.toBeNull();
  });

  it('still stops once MAX_REMINDERS_BEFORE_RESEND is hit, independent of stopAfter', () => {
    const config = ZEnvelopeReminderSettings.parse({
      sendAfter: { unit: 'day', amount: 1 },
      repeatEvery: { unit: 'day', amount: 1 },
      stopAfter: { unit: 'day', amount: 365 },
    });

    const next = resolveNextReminderAt({
      config,
      sentAt: SENT_AT,
      lastReminderSentAt: new Date(SENT_AT.getTime() + 10 * 86_400_000),
      reminderCount: MAX_REMINDERS_BEFORE_RESEND,
    });

    expect(next).toBeNull();
  });
});

describe('ZEnvelopeReminderSettings validation', () => {
  it('rejects a stopAfter shorter than sendAfter', () => {
    const result = ZEnvelopeReminderSettings.safeParse({
      sendAfter: { unit: 'day', amount: 10 },
      repeatEvery: { unit: 'day', amount: 2 },
      stopAfter: { unit: 'day', amount: 5 },
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(['stopAfter']);
    }
  });

  it('accepts a stopAfter equal to or longer than sendAfter', () => {
    expect(
      ZEnvelopeReminderSettings.safeParse({
        sendAfter: { unit: 'day', amount: 5 },
        repeatEvery: { unit: 'day', amount: 2 },
        stopAfter: { unit: 'day', amount: 5 },
      }).success,
    ).toBe(true);

    expect(
      ZEnvelopeReminderSettings.safeParse({
        sendAfter: { unit: 'day', amount: 5 },
        repeatEvery: { unit: 'day', amount: 2 },
        stopAfter: { unit: 'day', amount: 30 },
      }).success,
    ).toBe(true);
  });

  it('skips the ordering check when sendAfter is disabled', () => {
    expect(
      ZEnvelopeReminderSettings.safeParse({
        sendAfter: { disabled: true },
        repeatEvery: { disabled: true },
        stopAfter: { unit: 'day', amount: 1 },
      }).success,
    ).toBe(true);
  });

  it('allows omitting stopAfter entirely', () => {
    expect(
      ZEnvelopeReminderSettings.safeParse({
        sendAfter: { unit: 'day', amount: 5 },
        repeatEvery: { unit: 'day', amount: 2 },
      }).success,
    ).toBe(true);
  });

  it('rejects a stopAfter that exceeds MAX_REMINDER_PERIOD_DAYS instead of silently overflowing', () => {
    const atLimit = ZEnvelopeReminderSettings.safeParse({
      sendAfter: { unit: 'day', amount: 5 },
      repeatEvery: { unit: 'day', amount: 2 },
      stopAfter: { unit: 'day', amount: MAX_REMINDER_PERIOD_DAYS },
    });

    expect(atLimit.success).toBe(true);

    const overLimit = ZEnvelopeReminderSettings.safeParse({
      sendAfter: { unit: 'day', amount: 5 },
      repeatEvery: { unit: 'day', amount: 2 },
      stopAfter: { unit: 'day', amount: MAX_REMINDER_PERIOD_DAYS + 1 },
    });

    expect(overLimit.success).toBe(false);

    const absurdlyLarge = ZEnvelopeReminderSettings.safeParse({
      sendAfter: { unit: 'day', amount: 5 },
      repeatEvery: { unit: 'day', amount: 2 },
      stopAfter: { unit: 'day', amount: 999_999_999 },
    });

    expect(absurdlyLarge.success).toBe(false);
  });

  it('also bounds sendAfter and repeatEvery, since they share the same duration schema as stopAfter', () => {
    expect(
      ZEnvelopeReminderSettings.safeParse({
        sendAfter: { unit: 'day', amount: 999_999_999 },
        repeatEvery: { unit: 'day', amount: 2 },
      }).success,
    ).toBe(false);

    expect(
      ZEnvelopeReminderSettings.safeParse({
        sendAfter: { unit: 'day', amount: 5 },
        repeatEvery: { unit: 'month', amount: 999_999_999 },
      }).success,
    ).toBe(false);
  });
});

describe('isStopAfterAtLeastSendAfter', () => {
  it('returns true when stopAfter is undefined', () => {
    expect(isStopAfterAtLeastSendAfter({ unit: 'day', amount: 5 }, undefined)).toBe(true);
  });

  it('returns true when sendAfter is disabled, regardless of stopAfter', () => {
    expect(isStopAfterAtLeastSendAfter({ disabled: true }, { unit: 'day', amount: 1 })).toBe(true);
  });

  it('returns false when stopAfter is shorter than sendAfter', () => {
    expect(isStopAfterAtLeastSendAfter({ unit: 'day', amount: 10 }, { unit: 'day', amount: 5 })).toBe(false);
  });

  it('returns true when stopAfter is equal to or longer than sendAfter', () => {
    expect(isStopAfterAtLeastSendAfter({ unit: 'day', amount: 5 }, { unit: 'day', amount: 5 })).toBe(true);
    expect(isStopAfterAtLeastSendAfter({ unit: 'day', amount: 5 }, { unit: 'week', amount: 1 })).toBe(true);
  });
});
