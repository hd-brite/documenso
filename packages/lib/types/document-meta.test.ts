import { describe, expect, it } from 'vitest';

import { ZDocumentMetaCreateSchema } from './document-meta';

describe('ZDocumentMetaCreateSchema senderName', () => {
  it('accepts a sender name and trims it', () => {
    expect(ZDocumentMetaCreateSchema.parse({ senderName: '  Shaun Ross ' }).senderName).toBe('Shaun Ross');
  });

  it('accepts a missing or null sender name', () => {
    expect(ZDocumentMetaCreateSchema.parse({}).senderName).toBeUndefined();
    expect(ZDocumentMetaCreateSchema.parse({ senderName: null }).senderName).toBeNull();
  });

  it('rejects a sender name longer than 100 characters', () => {
    expect(ZDocumentMetaCreateSchema.safeParse({ senderName: 'a'.repeat(101) }).success).toBe(false);
  });
});
