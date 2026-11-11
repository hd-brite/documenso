import type { DocumentMeta } from '@prisma/client';
import { describe, expect, it } from 'vitest';

import { DOCUMENT_META_DIFF_TYPE } from '../types/document-audit-logs';
import { diffDocumentMetaChanges } from './document-audit-logs';

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
