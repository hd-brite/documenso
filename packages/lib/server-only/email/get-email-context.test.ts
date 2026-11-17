import { OrganisationType } from '@prisma/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DOCUMENSO_INTERNAL_EMAIL } from '../../constants/email';
import { getEmailContext } from './get-email-context';

const { findTeam } = vi.hoisted(() => ({ findTeam: vi.fn() }));

vi.mock('@documenso/prisma', () => ({
  prisma: { team: { findFirst: findTeam } },
}));

vi.mock('@documenso/email/mailer', () => ({ mailer: { sendMail: vi.fn() } }));

const RLN_TEAM_ID = 7;

const teamRow = (teamId: number) => ({
  id: teamId,
  teamGlobalSettings: {},
  organisation: {
    id: 'org_1',
    type: OrganisationType.ORGANISATION,
    owner: { id: 1, disabled: false },
    organisationClaim: { flags: {}, emailTransportId: null },
    organisationGlobalSettings: { documentLanguage: 'en', emailId: null, emailReplyTo: null },
    emailDomains: [],
  },
});

const recipientContext = (teamId: number, senderName: string | null) =>
  getEmailContext({
    emailType: 'RECIPIENT',
    source: { type: 'team', teamId },
    meta: { senderName, emailReplyTo: 'shaun.ross@example.invalid' },
  });

describe('getEmailContext envelope sender name (BL-3903)', () => {
  beforeEach(() => {
    vi.stubEnv('NEXT_PRIVATE_BRITE_SENDER_NAME_TEAM_IDS', String(RLN_TEAM_ID));
    findTeam.mockImplementation(async ({ where }: { where: { id: number } }) => teamRow(where.id));
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    findTeam.mockReset();
  });

  it('uses the sender name as the From name of an allowed team, keeping the address and reply-to', async () => {
    const context = await recipientContext(RLN_TEAM_ID, 'Shaun Ross');

    expect(context.senderEmail).toEqual({ name: 'No Reply - Shaun Ross', address: DOCUMENSO_INTERNAL_EMAIL.address });
    expect(context.replyToEmail).toBe('shaun.ross@example.invalid');
  });

  it('prefixes the From name of a non-invite recipient email (completed email call shape)', async () => {
    // send-document-completed-emails passes the whole envelope.documentMeta, not a hand-built object.
    const context = await getEmailContext({
      emailType: 'RECIPIENT',
      source: { type: 'team', teamId: RLN_TEAM_ID },
      meta: { senderName: 'Shaun Ross', subject: '', message: '', emailReplyTo: 'shaun.ross@example.invalid' },
    });

    expect(context.senderEmail).toEqual({ name: 'No Reply - Shaun Ross', address: DOCUMENSO_INTERNAL_EMAIL.address });
    expect(context.replyToEmail).toBe('shaun.ross@example.invalid');
  });

  it('ignores the sender name for a team that is not allowed', async () => {
    const context = await recipientContext(8, 'Hunter Douglas Billing');

    expect(context.senderEmail).toEqual(DOCUMENSO_INTERNAL_EMAIL);
  });

  it('keeps the instance From name when the envelope has no sender name', async () => {
    const context = await recipientContext(RLN_TEAM_ID, null);

    expect(context.senderEmail).toEqual(DOCUMENSO_INTERNAL_EMAIL);
  });

  it('never applies the sender name to internal emails', async () => {
    const context = await getEmailContext({
      emailType: 'INTERNAL',
      source: { type: 'team', teamId: RLN_TEAM_ID },
      meta: { senderName: 'Shaun Ross' },
    });

    expect(context.senderEmail).toEqual(DOCUMENSO_INTERNAL_EMAIL);
  });
});

describe('getEmailContext envelope email logo (RLN-410)', () => {
  const THD_LOGO = 'https://hdbrite.com/email-assets/rln/email-logo-thd-v1.png';
  const SALES_TEAM_ID = 13;

  beforeEach(() => {
    vi.stubEnv('NEXT_PRIVATE_BRITE_EMAIL_LOGO_TEAM_IDS', String(RLN_TEAM_ID));
    vi.stubEnv('NEXT_PRIVATE_BRITE_EMAIL_LOGO_URL_PREFIXES', 'https://hdbrite.com/email-assets/rln/');
    findTeam.mockImplementation(async ({ where }: { where: { id: number } }) => teamRow(where.id));
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    findTeam.mockReset();
  });

  const logoContext = (
    teamId: number,
    emailLogoUrl: string | null,
    emailType: 'RECIPIENT' | 'INTERNAL' = 'RECIPIENT',
  ) =>
    getEmailContext({
      emailType,
      source: { type: 'team', teamId },
      meta: { emailLogoUrl, senderName: null, emailReplyTo: null },
    });

  it('puts the envelope logo on the branding of an allowed team', async () => {
    const context = await logoContext(RLN_TEAM_ID, THD_LOGO);

    expect(context.branding.envelopeLogo).toBe(THD_LOGO);
  });

  it('ignores the envelope logo for a team that is not allowed (Brite Sales)', async () => {
    const context = await logoContext(SALES_TEAM_ID, THD_LOGO);

    expect(context.branding.envelopeLogo).toBeUndefined();
  });

  it('ignores a logo outside the allowed prefixes', async () => {
    const context = await logoContext(RLN_TEAM_ID, 'https://evil.example/email-assets/rln/a.png');

    expect(context.branding.envelopeLogo).toBeUndefined();
  });

  it('shows no envelope logo when the team allowlist is unset (kill switch)', async () => {
    vi.stubEnv('NEXT_PRIVATE_BRITE_EMAIL_LOGO_TEAM_IDS', '');
    const context = await logoContext(RLN_TEAM_ID, THD_LOGO);

    expect(context.branding.envelopeLogo).toBeUndefined();
  });

  it('keeps the team branding when the envelope has no logo', async () => {
    const context = await logoContext(RLN_TEAM_ID, null);

    expect(context.branding.envelopeLogo).toBeUndefined();
  });

  it('never applies the envelope logo to internal emails', async () => {
    const context = await logoContext(RLN_TEAM_ID, THD_LOGO, 'INTERNAL');

    expect(context.branding.envelopeLogo).toBeUndefined();
  });
});
