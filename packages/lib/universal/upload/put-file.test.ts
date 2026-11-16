import { afterEach, describe, expect, it, vi } from 'vitest';

import { putImageFile } from './put-file';

const logo = {
  name: 'brite-sign-logo-v1.png',
  type: 'image/png',
  arrayBuffer: async () => Promise.resolve(new Uint8Array([137, 80, 78, 71]).buffer),
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('putImageFile', () => {
  it('posts the image to the server route, never to a presigned storage URL', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ type: 'S3_PATH', data: '21/abc/brite-sign-logo-v1.png' }), { status: 200 }),
      );
    vi.stubGlobal('fetch', fetchMock);

    const result = await putImageFile(logo);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/files/upload-image');
    expect(init.method).toBe('POST');

    const uploaded = (init.body as FormData).get('file') as File;
    expect(uploaded.name).toBe('brite-sign-logo-v1.png');
    expect(uploaded.type).toBe('image/png');
    expect(uploaded.size).toBe(4);

    expect(result).toEqual({ type: 'S3_PATH', data: '21/abc/brite-sign-logo-v1.png' });
  });

  it('sends the embedding presign token when given', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ type: 'BYTES_64', data: 'iVBORw==' }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await putImageFile(logo, { presignToken: 'tok' });

    expect(fetchMock.mock.calls[0][1].headers).toEqual({ Authorization: 'Bearer tok' });
  });

  it('throws when the server rejects the upload', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{"error":"File too large"}', { status: 400 })));

    await expect(putImageFile(logo)).rejects.toThrow();
  });
});
