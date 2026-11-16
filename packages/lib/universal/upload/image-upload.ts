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
