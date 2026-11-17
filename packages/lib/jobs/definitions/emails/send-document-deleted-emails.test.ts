import { describe, expect, it } from 'vitest';

import { SEND_DOCUMENT_DELETED_EMAILS_JOB_DEFINITION } from './send-document-deleted-emails';

// Brite (BL-3903, RLN-410): the deleted email job gets a hand-built copy of the envelope meta,
// so a field missing from its schema is silently dropped before getEmailContext sees it.
describe('send document deleted emails job payload', () => {
  const payload = {
    teamId: 7,
    documentName: 'John Smith (Project 1)',
    inviterEmail: 'owner@example.com',
    recipients: [{ email: 'john@example.com', name: 'John Smith' }],
  };

  it('keeps the sender name and the envelope logo', () => {
    const parsed = SEND_DOCUMENT_DELETED_EMAILS_JOB_DEFINITION.trigger.schema.parse({
      ...payload,
      meta: {
        emailId: null,
        emailReplyTo: 'shaun.ross@example.invalid',
        language: 'en',
        senderName: 'Shaun Ross',
        emailLogoUrl: 'https://hdbrite.com/email-assets/rln/email-logo-thd-v1.png',
      },
    });

    expect(parsed.meta).toMatchObject({
      senderName: 'Shaun Ross',
      emailLogoUrl: 'https://hdbrite.com/email-assets/rln/email-logo-thd-v1.png',
    });
  });

  it('accepts a payload queued before these fields existed', () => {
    const parsed = SEND_DOCUMENT_DELETED_EMAILS_JOB_DEFINITION.trigger.schema.parse({
      ...payload,
      meta: { emailId: null, emailReplyTo: null, language: 'en' },
    });

    expect(parsed.meta?.emailLogoUrl).toBeUndefined();
    expect(parsed.meta?.senderName).toBeUndefined();
  });
});
