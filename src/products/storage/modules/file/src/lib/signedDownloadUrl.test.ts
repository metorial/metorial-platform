import { beforeEach, describe, expect, it, vi } from 'vitest';

let state = vi.hoisted(() => ({
  downloadPublicUrl: undefined as string | undefined,
  filesUrl: 'https://metorial.example.com' as string | undefined
}));

vi.mock('../env', () => ({
  env: {
    service: {
      get DOWNLOAD_PUBLIC_URL() {
        return state.downloadPublicUrl;
      },
      METORIAL_REGION: 'test',
      SIGNED_DOWNLOAD_URL_TOKEN_SECRET: 'test-secret'
    }
  }
}));

vi.mock('@metorial/config', () => ({
  getConfig: () => ({ urls: { filesUrl: state.filesUrl } })
}));

import { getSignedFileDownloadUrl } from './signedDownloadUrl';

let file = { id: 'fil_1', storeId: 'str_1' };

describe('getSignedFileDownloadUrl', () => {
  beforeEach(() => {
    state.downloadPublicUrl = undefined;
    state.filesUrl = 'https://metorial.example.com';
  });

  it('falls back to the shared files url', async () => {
    let url = await getSignedFileDownloadUrl(file);
    expect(url?.startsWith('https://metorial.example.com/files/fil_1/')).toBe(true);
  });

  it('prefers an explicit DOWNLOAD_PUBLIC_URL', async () => {
    state.downloadPublicUrl = 'https://files.example.com/';
    let url = await getSignedFileDownloadUrl(file);
    expect(url?.startsWith('https://files.example.com/files/fil_1/')).toBe(true);
  });

  it('returns undefined when nothing is configured', async () => {
    state.filesUrl = undefined;
    expect(await getSignedFileDownloadUrl(file)).toBeUndefined();
  });
});
