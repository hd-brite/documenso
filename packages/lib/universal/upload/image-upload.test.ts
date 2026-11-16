import { describe, expect, it } from 'vitest';

import { hasImageSignature, IMAGE_UPLOAD_SIZE_LIMIT_BYTES, validateImageUpload } from './image-upload';

const fakeFile = (type: string, size: number) => ({ type, size });

describe('validateImageUpload', () => {
  it.each(['image/png', 'image/jpeg', 'image/webp', 'IMAGE/PNG', 'image/png; charset=binary'])('accepts %s', (type) => {
    expect(validateImageUpload(fakeFile(type, 1767))).toBeNull();
  });

  it.each(['application/pdf', 'image/svg+xml', 'text/html', ''])('rejects content type "%s"', (type) => {
    expect(validateImageUpload(fakeFile(type, 1767))).toBe('UNSUPPORTED_TYPE');
  });

  it('rejects an empty file', () => {
    expect(validateImageUpload(fakeFile('image/png', 0))).toBe('EMPTY');
  });

  it('reports an empty file with no content type as empty, not as the wrong type', () => {
    expect(validateImageUpload(fakeFile('', 0))).toBe('EMPTY');
  });

  it('accepts a file exactly at the size limit', () => {
    expect(validateImageUpload(fakeFile('image/png', IMAGE_UPLOAD_SIZE_LIMIT_BYTES))).toBeNull();
  });

  it('rejects a file over the size limit', () => {
    expect(validateImageUpload(fakeFile('image/png', IMAGE_UPLOAD_SIZE_LIMIT_BYTES + 1))).toBe('TOO_LARGE');
  });
});

describe('hasImageSignature', () => {
  const bytes = (...values: number[]) => new Uint8Array(values);

  it('accepts a PNG', () => {
    expect(hasImageSignature(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0))).toBe(true);
  });

  it('accepts a JPEG', () => {
    expect(hasImageSignature(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe(true);
  });

  it('accepts a WebP', () => {
    expect(hasImageSignature(bytes(0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x45, 0x42, 0x50))).toBe(true);
  });

  it('rejects a PDF labelled as an image', () => {
    expect(hasImageSignature(new TextEncoder().encode('%PDF-1.7\n'))).toBe(false);
  });

  it('rejects a RIFF file that is not WebP', () => {
    expect(hasImageSignature(bytes(0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x41, 0x56, 0x45))).toBe(false);
  });

  it('rejects empty and truncated input', () => {
    expect(hasImageSignature(bytes())).toBe(false);
    expect(hasImageSignature(bytes(0x89, 0x50))).toBe(false);
  });
});
