import { ObjectStorageError } from 'object-storage-client';
import { describe, expect, it, vi } from 'vitest';

import { resolveUploadStreamDestination } from './uploadDestination';

describe('resolveUploadStreamDestination', () => {
  it('prefers a presigned url', async () => {
    let destination = await resolveUploadStreamDestination({
      bucket: 'files',
      key: 'str_a',
      presign: async () => ({ url: 'https://example.com/signed', headers: {} })
    });

    expect(destination).toEqual({
      type: 'signed_url',
      url: 'https://example.com/signed',
      headers: {}
    });
  });

  it('keeps the headers the signed url requires', async () => {
    let destination = await resolveUploadStreamDestination({
      bucket: 'files',
      key: 'str_a',
      presign: async () => ({
        url: 'https://example.com/signed',
        headers: { 'x-ms-blob-type': 'BlockBlob' }
      })
    });

    expect(destination).toEqual({
      type: 'signed_url',
      url: 'https://example.com/signed',
      headers: { 'x-ms-blob-type': 'BlockBlob' }
    });
  });

  it('falls back to an internal destination when the backend cannot presign', async () => {
    let destination = await resolveUploadStreamDestination({
      bucket: 'files',
      key: 'str_a',
      presign: async () => {
        throw new ObjectStorageError('not supported', 501);
      }
    });

    expect(destination).toEqual({
      type: 'internal',
      bucket: 'files',
      key: 'str_a'
    });
  });

  it('rethrows non-storage failures instead of silently changing transport', async () => {
    let presign = vi.fn(async () => {
      throw new TypeError('boom');
    });

    await expect(
      resolveUploadStreamDestination({ bucket: 'files', key: 'str_a', presign })
    ).rejects.toThrow('boom');
  });
});
