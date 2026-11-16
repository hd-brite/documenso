import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getEnvelopeEmailLogoUrl, isEmailLogoAllowedForTeam, withoutEnvelopeEmailLogo } from './envelope-email-logo';

const RLN_TEAM_ID = 7;
const SALES_TEAM_ID = 13;
const THD_LOGO = 'https://hdbrite.com/email-assets/rln/email-logo-thd-v1.png';

beforeEach(() => {
  vi.stubEnv('NEXT_PRIVATE_BRITE_EMAIL_LOGO_TEAM_IDS', ` ${RLN_TEAM_ID}, 42 `);
  vi.stubEnv(
    'NEXT_PRIVATE_BRITE_EMAIL_LOGO_URL_PREFIXES',
    ' https://hdbrite.com/email-assets/rln/ , https://cdn.example.com/logos/ ',
  );
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('isEmailLogoAllowedForTeam', () => {
  it('allows only the listed teams', () => {
    expect(isEmailLogoAllowedForTeam(RLN_TEAM_ID)).toBe(true);
    expect(isEmailLogoAllowedForTeam(42)).toBe(true);
    expect(isEmailLogoAllowedForTeam(SALES_TEAM_ID)).toBe(false);
    expect(isEmailLogoAllowedForTeam(null)).toBe(false);
    expect(isEmailLogoAllowedForTeam(undefined)).toBe(false);
  });

  it('allows no team when the setting is unset or empty (the kill switch)', () => {
    vi.stubEnv('NEXT_PRIVATE_BRITE_EMAIL_LOGO_TEAM_IDS', '');
    expect(isEmailLogoAllowedForTeam(RLN_TEAM_ID)).toBe(false);
  });
});

describe('getEnvelopeEmailLogoUrl', () => {
  it('returns the logo of an allowed team on an allowed host', () => {
    expect(getEnvelopeEmailLogoUrl({ emailLogoUrl: THD_LOGO }, RLN_TEAM_ID)).toBe(THD_LOGO);
    expect(getEnvelopeEmailLogoUrl({ emailLogoUrl: ` ${THD_LOGO} ` }, RLN_TEAM_ID)).toBe(THD_LOGO);
  });

  it('matches the host without regard to case and accepts an explicit 443 port', () => {
    expect(getEnvelopeEmailLogoUrl({ emailLogoUrl: 'https://HDBrite.com/email-assets/rln/a.png' }, RLN_TEAM_ID)).toBe(
      'https://hdbrite.com/email-assets/rln/a.png',
    );
    expect(
      getEnvelopeEmailLogoUrl({ emailLogoUrl: 'https://hdbrite.com:443/email-assets/rln/a.png' }, RLN_TEAM_ID),
    ).toBe('https://hdbrite.com/email-assets/rln/a.png');
    expect(getEnvelopeEmailLogoUrl({ emailLogoUrl: 'https://cdn.example.com/logos/x/b.png' }, RLN_TEAM_ID)).toBe(
      'https://cdn.example.com/logos/x/b.png',
    );
  });

  it('returns null without meta or without a logo', () => {
    expect(getEnvelopeEmailLogoUrl(undefined, RLN_TEAM_ID)).toBeNull();
    expect(getEnvelopeEmailLogoUrl(null, RLN_TEAM_ID)).toBeNull();
    expect(getEnvelopeEmailLogoUrl({}, RLN_TEAM_ID)).toBeNull();
    expect(getEnvelopeEmailLogoUrl({ emailLogoUrl: null }, RLN_TEAM_ID)).toBeNull();
    expect(getEnvelopeEmailLogoUrl({ emailLogoUrl: '   ' }, RLN_TEAM_ID)).toBeNull();
  });

  it('ignores the logo for a team that is not allowed (Brite Sales keeps the Brite logo)', () => {
    expect(getEnvelopeEmailLogoUrl({ emailLogoUrl: THD_LOGO }, SALES_TEAM_ID)).toBeNull();
    expect(getEnvelopeEmailLogoUrl({ emailLogoUrl: THD_LOGO }, null)).toBeNull();
  });

  it('ignores every logo when no prefix is allowed', () => {
    vi.stubEnv('NEXT_PRIVATE_BRITE_EMAIL_LOGO_URL_PREFIXES', '');
    expect(getEnvelopeEmailLogoUrl({ emailLogoUrl: THD_LOGO }, RLN_TEAM_ID)).toBeNull();
  });

  it.each([
    ['a whole host', 'https://hdbrite.com'],
    ['a host with a bare slash', 'https://hdbrite.com/'],
    ['a path that does not end in a slash', 'https://hdbrite.com/email-assets/rln'],
    ['plain http', 'http://hdbrite.com/email-assets/rln/'],
    ['not a URL', 'hdbrite.com/email-assets/rln/'],
  ])('never widens the allowlist from a misconfigured prefix (%s)', (_label, prefix) => {
    vi.stubEnv('NEXT_PRIVATE_BRITE_EMAIL_LOGO_URL_PREFIXES', prefix);
    expect(getEnvelopeEmailLogoUrl({ emailLogoUrl: 'https://hdbrite.com/x.png' }, RLN_TEAM_ID)).toBeNull();
    expect(
      getEnvelopeEmailLogoUrl({ emailLogoUrl: 'https://hdbrite.com/email-assets/rlnx.png' }, RLN_TEAM_ID),
    ).toBeNull();
  });

  it.each([
    ['plain http', 'http://hdbrite.com/email-assets/rln/a.png'],
    ['another host', 'https://evil.example/email-assets/rln/a.png'],
    ['a subdomain of an allowed host', 'https://x.hdbrite.com/email-assets/rln/a.png'],
    ['an allowed host as a suffix', 'https://evilhdbrite.com/email-assets/rln/a.png'],
    ['an allowed host as a prefix', 'https://hdbrite.com.evil.example/email-assets/rln/a.png'],
    ['credentials in the URL', 'https://user:pass@hdbrite.com/email-assets/rln/a.png'],
    ['a user name in the URL', 'https://hdbrite.com@evil.example/email-assets/rln/a.png'],
    ['another port', 'https://hdbrite.com:8443/email-assets/rln/a.png'],
    ['another path on the allowed host', 'https://hdbrite.com/api/logo.png'],
    ['the Next image proxy', 'https://hdbrite.com/_next/image?url=https://evil.example/a.png'],
    ['a query string', 'https://hdbrite.com/email-assets/rln/a.png?x=1'],
    ['a fragment', 'https://hdbrite.com/email-assets/rln/a.png#x'],
    ['a dot-dot segment', 'https://hdbrite.com/email-assets/rln/../../api/a.png'],
    ['a dot segment', 'https://hdbrite.com/email-assets/./rln/a.png'],
    ['a percent-encoded segment', 'https://hdbrite.com/email-assets/rln/%2e%2e/a.png'],
    ['a backslash', 'https://hdbrite.com/email-assets/rln\\..\\a.png'],
    ['a file that is not a png', 'https://hdbrite.com/email-assets/rln/a.svg'],
    ['a sibling folder sharing the prefix text', 'https://hdbrite.com/email-assets/rln-evil/a.png'],
    ['a data URL', 'data:image/png;base64,AAAA'],
    ['a javascript URL', 'javascript:alert(1)'],
    ['a relative path', '/static/logo.png'],
    ['not a URL', 'not a url'],
  ])('ignores %s', (_label, emailLogoUrl) => {
    expect(getEnvelopeEmailLogoUrl({ emailLogoUrl }, RLN_TEAM_ID)).toBeNull();
  });

  it('ignores a URL longer than the stored limit', () => {
    const long = `https://hdbrite.com/${'a'.repeat(2048)}.png`;
    expect(getEnvelopeEmailLogoUrl({ emailLogoUrl: long }, RLN_TEAM_ID)).toBeNull();
  });
});

describe('withoutEnvelopeEmailLogo', () => {
  it('drops the logo and keeps the other meta fields', () => {
    expect(withoutEnvelopeEmailLogo({ emailLogoUrl: THD_LOGO, subject: 'Hi' })).toEqual({
      emailLogoUrl: null,
      subject: 'Hi',
    });
  });

  it('passes null and undefined through', () => {
    expect(withoutEnvelopeEmailLogo(null)).toBeNull();
    expect(withoutEnvelopeEmailLogo(undefined)).toBeUndefined();
  });
});
