import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMetorialDashboardSDK, smallFileDirectUploadMaxBytes } from './sdk';

let apiHost = 'https://metorial.example.test/v1';
let uploadUrl = 'https://metorial.example.test/object-storage/files/archive';

afterEach(() => vi.unstubAllGlobals());

describe('on-prem file uploads', () => {
  it('sends a large file through the signed URL on a custom hostname', async () => {
    let sdk = createMetorialDashboardSDK({ apiHost, supportsPresignedFileUploads: true });
    let file = new File(['test'], 'archive.zip', { type: 'application/zip' });
    let size = 2 * 1024 ** 3;
    Object.defineProperty(file, 'size', { value: size });

    let fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(Response.json({ id: 'upload_1', upload: { url: uploadUrl } }))
      .mockResolvedValueOnce(new Response(null, { status: 201 }))
      .mockResolvedValueOnce(Response.json({ id: 'file_1' }));
    vi.stubGlobal('fetch', fetch);

    let result = await sdk.files.upload({
      instanceId: 'instance_1',
      file,
      purpose: 'generic'
    });

    expect(result.id).toBe('file_1');
    expect(fetch.mock.calls.map(([url, init]) => [url, init?.method])).toEqual([
      [`${apiHost}/files`, 'POST'],
      [uploadUrl, 'PUT'],
      [`${apiHost}/files`, 'POST']
    ]);
    expect(JSON.parse(fetch.mock.calls[0][1]?.body as string)).toMatchObject({
      mode: 'get_upload_url',
      instance_id: 'instance_1',
      file_name: 'archive.zip',
      file_size: size
    });
    expect(JSON.parse(fetch.mock.calls[0][1]?.body as string)).not.toHaveProperty(
      'accept_multipart'
    );
    expect(fetch.mock.calls[1][1]?.body).toBe(file);
    expect(JSON.parse(fetch.mock.calls[2][1]?.body as string)).toMatchObject({
      mode: 'complete',
      file_upload_id: 'upload_1'
    });
  });

  it('uses multipart for files at the 1 MiB cutoff', async () => {
    let sdk = createMetorialDashboardSDK({ apiHost, supportsPresignedFileUploads: true });
    let file = new File([new Uint8Array(smallFileDirectUploadMaxBytes)], 'small.bin');
    let fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(Response.json({ id: 'file_1' }));
    vi.stubGlobal('fetch', fetch);

    await sdk.files.upload({ instanceId: 'instance_1', file, purpose: 'generic' });

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith(
      `${apiHost}/files`,
      expect.objectContaining({ method: 'POST', body: expect.any(FormData) })
    );
  });
});

it('fetches the next batch and retries only the part with an expired manifest', async () => {
  let sdk = createMetorialDashboardSDK({
    apiHost,
    supportsPresignedFileUploads: true,
    supportsMultipartFileUploads: true
  });
  let file = new File(['abcdefghi'], 'archive.bin');
  let requestedParts: number[][] = [];
  let part = (number: number, manifest = `part-${number}`) => ({
    number,
    url: uploadUrl,
    manifest
  });
  let send = vi.fn<typeof globalThis.fetch>(async (url, request) => {
    if (url === uploadUrl) {
      let manifest = new Headers(request?.headers).get('x-metorial-upload-manifest');
      if (manifest === 'expired') return new Response(null, { status: 403 });
      let text = await (request?.body as Blob).text();
      return Response.json({ receipt: 'receipt-for-' + text });
    }

    let body = JSON.parse(request?.body as string);
    if (body.mode === 'get_upload_url') {
      expect(body.accept_multipart).toBe(true);
      return Response.json({
        id: 'upload_1',
        upload: {
          method: 'multipart',
          part_size: 1,
          part_count: 9,
          parts: Array.from({ length: 8 }, (_, index) =>
            index === 1 ? part(2, 'expired') : part(index + 1)
          )
        }
      });
    }
    if (body.mode === 'part_manifests') {
      requestedParts.push(body.part_numbers);
      return Response.json({ parts: body.part_numbers.map((number: number) => part(number)) });
    }

    expect(body.mode).toBe('complete');
    expect(body.receipts).toEqual(Array.from('abcdefghi', byte => 'receipt-for-' + byte));
    return Response.json({ id: 'file_1' });
  });
  vi.stubGlobal('fetch', send);

  let result = await sdk.files.upload({
    instanceId: 'instance_1',
    file,
    purpose: 'generic',
    mode: 'presigned'
  });

  expect(result.id).toBe('file_1');
  let sentParts = send.mock.calls
    .filter(([url]) => url === uploadUrl)
    .map(([, request]) => new Headers(request?.headers).get('x-metorial-upload-manifest'));
  expect(requestedParts).toEqual([[2], [9]]);
  expect(sentParts.filter(manifest => manifest !== 'expired').sort()).toEqual(
    Array.from({ length: 9 }, (_, index) => `part-${index + 1}`)
  );
  expect(sentParts).toHaveLength(10);
});
