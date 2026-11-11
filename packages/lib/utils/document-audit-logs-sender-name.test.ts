import type { DocumentMeta } from '@prisma/client';
import { describe, expect, it } from 'vitest';

import { DOCUMENT_META_DIFF_TYPE } from '../types/document-audit-logs';
import { diffDocumentMetaChanges, diffSenderNameChange } from './document-audit-logs';

// Brite (BL-3903): the sender name is the From name a recipient sees, so a change to it
// is recorded like a change to the reply-to address.
const meta = (fields: Partial<DocumentMeta>) => fields as DocumentMeta;

describe('diffDocumentMetaChanges sender name', () => {
  it('records a changed sender name', () => {
    expect(diffDocumentMetaChanges({ senderName: 'Shaun Ross' }, meta({ senderName: 'Scott Johnson' }))).toContainEqual(
      {
        type: DOCUMENT_META_DIFF_TYPE.SENDER_NAME,
        from: 'Shaun Ross',
        to: 'Scott Johnson',
      },
    );
  });

  it('records a sender name that is set or removed', () => {
    expect(diffDocumentMetaChanges({}, meta({ senderName: 'Shaun Ross' }))).toContainEqual({
      type: DOCUMENT_META_DIFF_TYPE.SENDER_NAME,
      from: null,
      to: 'Shaun Ross',
    });
    expect(diffDocumentMetaChanges({ senderName: 'Shaun Ross' }, meta({ senderName: null }))).toContainEqual({
      type: DOCUMENT_META_DIFF_TYPE.SENDER_NAME,
      from: 'Shaun Ross',
      to: null,
    });
  });

  it('records nothing when the sender name did not change', () => {
    expect(diffDocumentMetaChanges({ senderName: 'Shaun Ross' }, meta({ senderName: 'Shaun Ross' }))).toEqual([]);
  });
});

// updateEnvelope saves a partial meta and upstream writes no meta diff there, so the
// sender name gets its own diff that only looks at a field the update actually sends.
describe('diffSenderNameChange', () => {
  it('records a sender name the update changes', () => {
    expect(diffSenderNameChange({ senderName: 'Shaun Ross' }, { senderName: 'Scott Johnson' })).toEqual([
      { type: DOCUMENT_META_DIFF_TYPE.SENDER_NAME, from: 'Shaun Ross', to: 'Scott Johnson' },
    ]);
  });

  it('records a sender name the update sets or clears', () => {
    expect(diffSenderNameChange(null, { senderName: 'Shaun Ross' })).toEqual([
      { type: DOCUMENT_META_DIFF_TYPE.SENDER_NAME, from: null, to: 'Shaun Ross' },
    ]);
    expect(diffSenderNameChange({ senderName: 'Shaun Ross' }, { senderName: '' })).toEqual([
      { type: DOCUMENT_META_DIFF_TYPE.SENDER_NAME, from: 'Shaun Ross', to: null },
    ]);
  });

  it('records nothing when the update does not send a sender name', () => {
    expect(diffSenderNameChange({ senderName: 'Shaun Ross' }, { subject: 'Please sign' })).toEqual([]);
    expect(diffSenderNameChange({ senderName: 'Shaun Ross' }, undefined)).toEqual([]);
    // Prisma leaves a field alone when it is undefined, so that is not a clear.
    expect(diffSenderNameChange({ senderName: 'Shaun Ross' }, { senderName: undefined })).toEqual([]);
  });

  it('records nothing when the sender name is the same', () => {
    expect(diffSenderNameChange({ senderName: 'Shaun Ross' }, { senderName: 'Shaun Ross' })).toEqual([]);
    expect(diffSenderNameChange({ senderName: null }, { senderName: '' })).toEqual([]);
  });
});
