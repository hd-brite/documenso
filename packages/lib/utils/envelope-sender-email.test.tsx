import { renderWithI18N } from '@documenso/email/render';
import DocumentInviteEmailTemplate from '@documenso/email/templates/document-invite';
import { setupI18n } from '@lingui/core';
import { OrganisationType, RecipientRole } from '@prisma/client';
import { createElement } from 'react';
import { describe, expect, it } from 'vitest';

const i18n = setupI18n({ locale: 'en', messages: { en: {} } });

const DOCUMENT_NAME = 'John Smith (Project 98783983)';

const renderInvite = async (props: Record<string, unknown>) => {
  const element = createElement(DocumentInviteEmailTemplate, {
    role: RecipientRole.SIGNER,
    inviterName: 'Scott Johnson',
    inviterEmail: 'scott@example.com',
    documentName: DOCUMENT_NAME,
    organisationType: OrganisationType.ORGANISATION,
    teamName: 'RLN Documents',
    includeSenderDetails: true,
    ...props,
  });

  return renderWithI18N(element, { i18n, plainText: true });
};

describe('document invite email with an envelope sender name', () => {
  it('says the sender invited the recipient, without the team or the API token owner', async () => {
    const text = await renderInvite({ senderName: 'Shaun Ross' });

    expect(text).toContain('Shaun Ross has invited you to sign');
    expect(text).toContain(`"${DOCUMENT_NAME}"`);
    expect(text).not.toContain('on behalf of');
    expect(text).not.toContain('RLN Documents');
    expect(text).not.toContain('Scott Johnson');
  });

  it('keeps the upstream team wording when no sender name is set', async () => {
    const text = await renderInvite({});

    expect(text).toContain('Scott Johnson on behalf of "RLN Documents" has invited you to sign');
  });

  it('keeps the self-signer wording even when a sender name is set', async () => {
    const text = await renderInvite({ senderName: 'Shaun Ross', selfSigner: true });

    expect(text).toContain('Please sign your document');
    expect(text).not.toContain('Shaun Ross has invited you');
  });
});
