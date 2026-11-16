import type { DocumentMeta } from '@prisma/client';
import { describe, expect, it } from 'vitest';

import { DOCUMENT_META_DIFF_TYPE } from '../types/document-audit-logs';
import { diffDocumentMetaChanges } from './document-audit-logs';

// Brite (RLN-410): the envelope logo is the picture at the top of every recipient email,
// so a change to it is recorded like a change to the sender name.
const meta = (fields: Partial<DocumentMeta>) => fields as DocumentMeta;
const THD_LOGO = 'https://hdbrite.com/email-assets/rln/email-logo-thd-v1.png';
const COSTCO_LOGO = 'https://hdbrite.com/email-assets/rln/email-logo-costco-en-v1.png';

describe('diffDocumentMetaChanges email logo', () => {
  it('records a changed logo', () => {
    expect(diffDocumentMetaChanges({ emailLogoUrl: THD_LOGO }, meta({ emailLogoUrl: COSTCO_LOGO }))).toContainEqual({
      type: DOCUMENT_META_DIFF_TYPE.EMAIL_LOGO_URL,
      from: THD_LOGO,
      to: COSTCO_LOGO,
    });
  });

  it('records a logo that is set or removed', () => {
    expect(diffDocumentMetaChanges({}, meta({ emailLogoUrl: THD_LOGO }))).toContainEqual({
      type: DOCUMENT_META_DIFF_TYPE.EMAIL_LOGO_URL,
      from: null,
      to: THD_LOGO,
    });
    expect(diffDocumentMetaChanges({ emailLogoUrl: THD_LOGO }, meta({ emailLogoUrl: null }))).toContainEqual({
      type: DOCUMENT_META_DIFF_TYPE.EMAIL_LOGO_URL,
      from: THD_LOGO,
      to: null,
    });
  });

  it('records nothing when the logo did not change', () => {
    expect(diffDocumentMetaChanges({ emailLogoUrl: THD_LOGO }, meta({ emailLogoUrl: THD_LOGO }))).toEqual([]);
  });
});
