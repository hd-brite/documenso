import { renderWithI18N } from '@documenso/email/render';
import DocumentCompletedEmailTemplate from '@documenso/email/templates/document-completed';
import DocumentInviteEmailTemplate from '@documenso/email/templates/document-invite';
import DocumentReminderEmailTemplate from '@documenso/email/templates/document-reminder';
import { setupI18n } from '@lingui/core';
import { OrganisationType, RecipientRole } from '@prisma/client';
import type { ReactElement } from 'react';
import { createElement } from 'react';
import { describe, expect, it } from 'vitest';

// Brite (RLN-410): the envelope logo replaces the team and Brite logo in recipient emails.
const i18n = setupI18n({ locale: 'en', messages: { en: {} } });

const ASSET_BASE_URL = 'https://sign.dev.hdbrite.com';
const THD_LOGO = 'https://hdbrite.com/email-assets/rln/email-logo-thd-v1.png';
const TEAM_LOGO = 'https://sign.dev.hdbrite.com/api/branding/logo/team/7';
const BRITE_LOGO = `${ASSET_BASE_URL}/static/logo.png`;

const baseBranding = {
  brandingEnabled: true,
  brandingUrl: 'https://brand.example.com',
  brandingLogo: TEAM_LOGO,
  brandingCompanyDetails: '',
  brandingHidePoweredBy: false,
};

const templates: Array<[string, () => ReactElement]> = [
  [
    'invite',
    () =>
      createElement(DocumentInviteEmailTemplate, {
        role: RecipientRole.SIGNER,
        inviterName: 'Scott Johnson',
        inviterEmail: 'scott@example.com',
        documentName: 'John Smith (Project 1)',
        organisationType: OrganisationType.ORGANISATION,
        teamName: 'RLN Documents',
        includeSenderDetails: true,
        assetBaseUrl: ASSET_BASE_URL,
      }),
  ],
  [
    'completed',
    () =>
      createElement(DocumentCompletedEmailTemplate, {
        documentName: 'John Smith (Project 1)',
        assetBaseUrl: ASSET_BASE_URL,
      }),
  ],
  [
    'reminder',
    () =>
      createElement(DocumentReminderEmailTemplate, {
        recipientName: 'John Smith',
        documentName: 'John Smith (Project 1)',
        signDocumentLink: 'https://sign.dev.hdbrite.com/sign/token',
        role: RecipientRole.SIGNER,
        assetBaseUrl: ASSET_BASE_URL,
      }),
  ],
];

// The same path as the email jobs: renderEmailWithI18N passes the context branding to render.
const renderHtml = (template: () => ReactElement, branding?: Record<string, unknown>) =>
  renderWithI18N(template(), { i18n, branding: branding ? { ...baseBranding, ...branding } : undefined });

const imgTags = (html: string) => html.match(/<img[^>]*>/g) ?? [];

describe.each(templates)('%s email logo', (_name, template) => {
  it('shows the envelope logo at 300x60, not linked, instead of the team logo', async () => {
    const html = await renderHtml(template, { envelopeLogo: THD_LOGO });
    const logo = imgTags(html).find((tag) => tag.includes(THD_LOGO));

    expect(logo).toBeDefined();
    expect(logo).toContain('width="300"');
    expect(logo).toContain('height="60"');
    expect(logo).not.toContain('h-6');
    expect(html).not.toContain(TEAM_LOGO);
    expect(html).not.toMatch(new RegExp(`<a[^>]*href="https://brand.example.com"[^>]*>\\s*<img[^>]*${THD_LOGO}`));
  });

  it('keeps the team logo when the envelope has no logo', async () => {
    const html = await renderHtml(template, {});

    expect(html).toContain(TEAM_LOGO);
    expect(html).not.toContain(THD_LOGO);
  });

  it('keeps the Brite logo without team branding or an envelope logo (Brite Sales)', async () => {
    const html = await renderHtml(template);

    expect(html).toContain(BRITE_LOGO);
    expect(html).not.toContain(THD_LOGO);
  });
});
