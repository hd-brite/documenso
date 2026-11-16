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

describe('ZDocumentMetaCreateSchema emailLogoUrl (RLN-410)', () => {
  const THD_LOGO = 'https://hdbrite.com/email-assets/rln/email-logo-thd-v1.png';

  it('accepts an https URL and trims it', () => {
    expect(ZDocumentMetaCreateSchema.parse({ emailLogoUrl: ` ${THD_LOGO} ` }).emailLogoUrl).toBe(THD_LOGO);
  });

  it('accepts a missing or null logo', () => {
    expect(ZDocumentMetaCreateSchema.parse({}).emailLogoUrl).toBeUndefined();
    expect(ZDocumentMetaCreateSchema.parse({ emailLogoUrl: null }).emailLogoUrl).toBeNull();
  });

  it.each([
    'http://hdbrite.com/a.png',
    'javascript:alert(1)',
    'data:image/png;base64,AAAA',
    'not a url',
    '/a.png',
  ])('rejects %s', (emailLogoUrl) => {
    expect(ZDocumentMetaCreateSchema.safeParse({ emailLogoUrl }).success).toBe(false);
  });

  it('rejects a URL longer than 2048 characters', () => {
    expect(
      ZDocumentMetaCreateSchema.safeParse({ emailLogoUrl: `https://hdbrite.com/${'a'.repeat(2048)}` }).success,
    ).toBe(false);
  });
});
