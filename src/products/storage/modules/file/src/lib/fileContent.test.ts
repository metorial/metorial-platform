import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  getFileByDownloadKey: vi.fn(),
  resolveDelegatedFileContent: vi.fn(),
  downloadDelegatedFileContent: vi.fn(),
  getDocumentByFileId: vi.fn(),
  hasPendingFileContent: vi.fn(),
  getStoredFileContentStream: vi.fn(),
  presignObjectDownload: vi.fn()
}));

vi.mock('../env', () => ({ env: { service: { FILE_ROUTER_SECRET: undefined } } }));
vi.mock('../services/fileDownload', () => ({
  fileDownloadService: { getFileByDownloadKey: mocks.getFileByDownloadKey }
}));
vi.mock('./delegation', () => ({
  resolveDelegatedFileContent: mocks.resolveDelegatedFileContent
}));
vi.mock('./ssrfDownload', () => ({
  downloadDelegatedFileContent: mocks.downloadDelegatedFileContent
}));
vi.mock('@metorial/module-documents', () => ({
  documentService: { getDocumentByFileId: mocks.getDocumentByFileId }
}));
vi.mock('./pendingFileContent', () => ({
  getStoredFileContent: vi.fn(),
  getStoredFileContentStream: mocks.getStoredFileContentStream,
  hasPendingFileContent: mocks.hasPendingFileContent
}));
vi.mock('../storage', () => ({ presignObjectDownload: mocks.presignObjectDownload }));

let { getCargoFileContent, getCargoFileSignedDownload } = await import('./fileContent');

describe('delegated file redirects', () => {
  let file = { oid: 1n, id: 'fil_1', storeId: '', delegatorOid: 2n };
  let link = { expiresAt: null };

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getFileByDownloadKey.mockResolvedValue({ file, link });
    mocks.resolveDelegatedFileContent.mockResolvedValue({
      type: 'redirect',
      url: 'https://attachments.example.com/file?token=short-lived'
    });
  });

  it('returns the redirect without downloading its content', async () => {
    expect(await getCargoFileContent({ fileId: file.id, key: 'key' })).toEqual({
      type: 'redirect',
      file,
      link,
      redirectUrl: 'https://attachments.example.com/file?token=short-lived'
    });
    expect(mocks.downloadDelegatedFileContent).not.toHaveBeenCalled();
  });

  it('marks the redirect as delegated for the file router', async () => {
    expect(await getCargoFileSignedDownload({ fileId: file.id, key: 'key' })).toEqual({
      file,
      link,
      url: 'https://attachments.example.com/file?token=short-lived',
      isDelegated: true
    });
    expect(mocks.presignObjectDownload).not.toHaveBeenCalled();
  });
});
