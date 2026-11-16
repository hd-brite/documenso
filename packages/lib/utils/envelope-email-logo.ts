import type { DocumentMeta } from '@prisma/client';

import { env } from './env';

type EmailLogoMeta = Partial<Pick<DocumentMeta, 'emailLogoUrl'>> | null | undefined;

/** Longest `meta.emailLogoUrl` the API accepts (`ZDocumentMetaEmailLogoUrlSchema`). */
export const MAX_EMAIL_LOGO_URL_LENGTH = 2048;

const listSetting = (name: 'NEXT_PRIVATE_BRITE_EMAIL_LOGO_TEAM_IDS' | 'NEXT_PRIVATE_BRITE_EMAIL_LOGO_URL_PREFIXES') =>
  (env(name) ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

/**
 * Brite (RLN-410): an envelope can carry the logo its recipient emails show
 * (`DocumentMeta.emailLogoUrl`), so an RLN signing email shows the partner channel
 * (The Home Depot, Costco, ...) instead of the team logo. One team keeps serving every
 * channel; no per-channel team, token or webhook.
 *
 * Only teams listed in NEXT_PRIVATE_BRITE_EMAIL_LOGO_TEAM_IDS may use it. Unset means no
 * team: the field is stored but ignored, which is also the kill switch. Any SSO user gets
 * a personal team, so without the allowlist anyone could put any picture at the top of
 * mail sent from our domain.
 */
export const isEmailLogoAllowedForTeam = (teamId: number | null | undefined) => {
  if (teamId === null || teamId === undefined) {
    return false;
  }

  return listSetting('NEXT_PRIVATE_BRITE_EMAIL_LOGO_TEAM_IDS').includes(String(teamId));
};

/**
 * The allowed URL prefixes, each an `https:` origin plus a path ending in `/`
 * (`https://hdbrite.com/email-assets/rln/`). Anything else in the setting is skipped,
 * so a typo can never widen the allowlist to a whole host.
 */
const getAllowedPrefixes = () =>
  listSetting('NEXT_PRIVATE_BRITE_EMAIL_LOGO_URL_PREFIXES').flatMap((value) => {
    try {
      const prefix = new URL(value);

      if (
        prefix.protocol !== 'https:' ||
        prefix.username ||
        prefix.password ||
        prefix.port ||
        prefix.search ||
        prefix.hash ||
        prefix.pathname.length < 2 ||
        !prefix.pathname.endsWith('/')
      ) {
        return [];
      }

      return [`${prefix.origin}${prefix.pathname}`];
    } catch {
      return [];
    }
  });

/**
 * The envelope logo to show, or null when unset, the team is not allowed or the URL is
 * not a plain `https:` `.png` URL under one of NEXT_PRIVATE_BRITE_EMAIL_LOGO_URL_PREFIXES.
 * A query string, fragment, credentials, a non-default port, a percent-encoded or dot
 * path segment are all refused, so the logo can never go through a proxy or redirect
 * route on the allowed host. Unset prefixes means no logo is shown.
 */
export const getEnvelopeEmailLogoUrl = (meta: EmailLogoMeta, teamId: number | null | undefined) => {
  if (!isEmailLogoAllowedForTeam(teamId)) {
    return null;
  }

  const raw = meta?.emailLogoUrl?.trim();

  if (!raw || raw.length > MAX_EMAIL_LOGO_URL_LENGTH || /[%\\?#]/.test(raw)) {
    return null;
  }

  let url: URL;

  try {
    url = new URL(raw);
  } catch {
    return null;
  }

  if (url.protocol !== 'https:' || url.username || url.password || url.port || url.search || url.hash) {
    return null;
  }

  if (!url.pathname.endsWith('.png')) {
    return null;
  }

  const normalized = `${url.origin}${url.pathname}`;

  // `new URL` silently resolves `/./` and `/../` segments, so a URL that changed while
  // parsing (other than the host's case and a default :443) is refused: the prefix
  // check must see exactly the path the caller sent.
  const rawWithNormalOrigin = raw.replace(/^https:\/\/[^/]+/i, (origin) => origin.toLowerCase().replace(/:443$/, ''));

  if (normalized !== rawWithNormalOrigin) {
    return null;
  }

  return getAllowedPrefixes().some((prefix) => normalized.startsWith(prefix)) ? normalized : null;
};

/**
 * Drops the envelope logo from copied meta, for documents made from a public direct
 * template link (same rule as `withoutEnvelopeSenderName`).
 */
export const withoutEnvelopeEmailLogo = <T extends { emailLogoUrl?: string | null }>(meta: T | null | undefined) =>
  meta ? { ...meta, emailLogoUrl: null } : meta;
