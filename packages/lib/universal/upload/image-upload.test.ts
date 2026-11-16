import { describe, expect, it } from 'vitest';

import { IMAGE_UPLOAD_SIZE_LIMIT_BYTES, validateImageUpload } from './image-upload';

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
