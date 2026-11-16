/**
 * Rules for images uploaded through `/api/files/upload-image` (branding logos).
 *
 * Shared by the server route and its tests so the browser form and the server
 * agree on what is accepted.
 */
export const ALLOWED_IMAGE_UPLOAD_CONTENT_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

/** Matches the 5 MB limit of the branding preferences form. */
export const IMAGE_UPLOAD_SIZE_LIMIT_BYTES = 5 * 1024 * 1024;

export type ImageUploadRejection = 'UNSUPPORTED_TYPE' | 'EMPTY' | 'TOO_LARGE';

type ImageUploadCandidate = {
  type: string;
  size: number;
};

/**
 * Returns why an image upload is rejected, or `null` when it is accepted.
 */
export const validateImageUpload = (file: ImageUploadCandidate): ImageUploadRejection | null => {
  const normalizedType = file.type.split(';').at(0)?.trim().toLowerCase();

  const isAllowedType = ALLOWED_IMAGE_UPLOAD_CONTENT_TYPES.some((allowed) => allowed === normalizedType);

  if (file.size <= 0) {
    return 'EMPTY';
  }

  if (!isAllowedType) {
    return 'UNSUPPORTED_TYPE';
  }

  if (file.size > IMAGE_UPLOAD_SIZE_LIMIT_BYTES) {
    return 'TOO_LARGE';
  }

  return null;
};

const startsWith = (bytes: Uint8Array, signature: number[], offset = 0) =>
  bytes.length >= offset + signature.length && signature.every((byte, index) => bytes[offset + index] === byte);

/**
 * Checks the file's first bytes, so a file labelled `image/png` must really be
 * a PNG, JPEG or WebP image.
 */
export const hasImageSignature = (bytes: Uint8Array): boolean => {
  const isPng = startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const isJpeg = startsWith(bytes, [0xff, 0xd8, 0xff]);
  const isWebp = startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) && startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8);

  return isPng || isJpeg || isWebp;
};
