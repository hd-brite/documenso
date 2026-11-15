import DocumentCompletedEmailTemplate from '@documenso/email/templates/document-completed';
import DocumentCreatedFromDirectTemplateEmailTemplate from '@documenso/email/templates/document-created-from-direct-template';
import DocumentInviteEmailTemplate from '@documenso/email/templates/document-invite';
import DocumentReminderEmailTemplate from '@documenso/email/templates/document-reminder';
import { OrganisationType, RecipientRole } from '@prisma/client';
import { createElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { renderEmailWithI18N } from './render-email-with-i18n';

// BL-3903: react-dom 18.3.1 `writeStringChunk` writes a whole 2048-byte block when a multi-byte
// character does not fit at its end, so the unused tail of the block goes out as NUL bytes and
// SendGrid cuts the email at the first one. These tests render with the real pipeline and look
// for NUL bytes, because asserting that content exists passes on the broken code too.

const NUL = '\u0000';
const WEBAPP_URL = 'https://sign.dev.hdbrite.com';
const DEV_TITLE = 'RLN Richardson31 (Project 95036718)';
const DEV_SENDER = 'Chelseas Test123';
const LENGTHS = Array.from({ length: 120 }, (_, i) => i + 1);

const repeatTo = (seed: string, length: number) => seed.repeat(Math.ceil(length / seed.length)).slice(0, length);

const renderBoth = async (element: React.ReactElement) => {
  const [html, text] = await Promise.all([
    renderEmailWithI18N(element, { lang: 'en' }),
    renderEmailWithI18N(element, { lang: 'en', plainText: true }),
  ]);

  return { html, text };
};

const nulFailures = async (build: (length: number) => React.ReactElement) => {
  const failures: string[] = [];

  for (const length of LENGTHS) {
    const { html, text } = await renderBoth(build(length));

    if (html.includes(NUL)) {
      failures.push(`html length ${length}`);
    }

    if (text.includes(NUL)) {
      failures.push(`text length ${length}`);
    }

    // Guards against a fix that removes NUL bytes by cutting the output short.
    if (!html.includes('</html>')) {
      failures.push(`html length ${length} not complete`);
    }

    if (text.trim().length === 0) {
      failures.push(`text length ${length} empty`);
    }
  }

  return failures;
};

const invite = (props: Record<string, unknown>) =>
  createElement(DocumentInviteEmailTemplate, {
    role: RecipientRole.SIGNER,
    inviterName: 'Scott Johnson',
    inviterEmail: 'scott@example.com',
    documentName: DEV_TITLE,
    signDocumentLink: `${WEBAPP_URL}/sign/token`,
    assetBaseUrl: WEBAPP_URL,
    organisationType: OrganisationType.ORGANISATION,
    teamName: 'RLN Documents',
    includeSenderDetails: true,
    ...props,
  });

// Each sweep renders 120 x 2 emails in one test, so allow more than Vitest's 5 s default on slow runners.
describe('rendered emails contain no NUL bytes', { timeout: 30_000 }, () => {
  it('invite with the BL-3903 dev inputs', async () => {
    const { html, text } = await renderBoth(invite({ senderName: DEV_SENDER }));

    expect(html.includes(NUL)).toBe(false);
    expect(text.includes(NUL)).toBe(false);
    expect(html).toContain('</html>');
    expect(html).toContain(`${WEBAPP_URL}/sign/token`);
    expect(text).toContain(`${WEBAPP_URL}/sign/token`);
  });

  it('invite for every title length 1..120', async () => {
    expect(await nulFailures((n) => invite({ senderName: DEV_SENDER, documentName: repeatTo(DEV_TITLE, n) }))).toEqual(
      [],
    );
  });

  it('invite for every sender name length 1..120', async () => {
    expect(await nulFailures((n) => invite({ senderName: repeatTo(DEV_SENDER, n) }))).toEqual([]);
  });

  it('invite without a sender name (upstream wording) for every title length', async () => {
    expect(await nulFailures((n) => invite({ documentName: repeatTo(DEV_TITLE, n) }))).toEqual([]);
  });

  it('completed email for every title length', async () => {
    expect(
      await nulFailures((n) =>
        createElement(DocumentCompletedEmailTemplate, {
          documentName: repeatTo(DEV_TITLE, n),
          downloadLink: `${WEBAPP_URL}/sign/token/complete`,
          assetBaseUrl: WEBAPP_URL,
        }),
      ),
    ).toEqual([]);
  });

  it('reminder email (reminder job and resend path) for every title length', async () => {
    expect(
      await nulFailures((n) =>
        createElement(DocumentReminderEmailTemplate, {
          recipientName: DEV_SENDER,
          documentName: repeatTo(DEV_TITLE, n),
          signDocumentLink: `${WEBAPP_URL}/sign/token`,
          assetBaseUrl: WEBAPP_URL,
          role: RecipientRole.SIGNER,
        }),
      ),
    ).toEqual([]);
  });

  it('direct template email for every title length', async () => {
    expect(
      await nulFailures((n) =>
        createElement(DocumentCreatedFromDirectTemplateEmailTemplate, {
          recipientName: DEV_SENDER,
          documentName: repeatTo(DEV_TITLE, n),
          documentLink: `${WEBAPP_URL}/sign/token`,
          assetBaseUrl: WEBAPP_URL,
        }),
      ),
    ).toEqual([]);
  });
});

describe('renderEmailWithI18N errors', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('surfaces "Failed to render email" when the render rejects', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const Boom = () => {
      throw new Error('boom');
    };

    const result = renderEmailWithI18N(createElement(Boom), { lang: 'en' });

    await expect(result).rejects.toThrow('Failed to render email');
    await expect(result).rejects.toMatchObject({ cause: expect.objectContaining({ message: 'boom' }) });
  });
});
