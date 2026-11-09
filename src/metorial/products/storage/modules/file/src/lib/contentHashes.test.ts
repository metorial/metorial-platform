import { hashBytes } from '@lowerdeck/hash/content';
import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  findPendingContent: vi.fn(),
  updateFiles: vi.fn(),
  getObjectStream: vi.fn()
}));

vi.mock('@metorial/db', () => ({
  db: {
    filePendingContent: { findUnique: mocks.findPendingContent },
    file: { updateMany: mocks.updateFiles }
  }
}));
vi.mock('../storage', () => ({
  getCargoFilesBucketName: () => 'cargo-files',
  getObjectStream: mocks.getObjectStream
}));

let { getFileContentHashes, hasValidContentHashes } = await import('./contentHashes');

let content = new TextEncoder().encode('hello\n');
let expected = hashBytes(content);

let objectStream = (bytes: Uint8Array, opts: { withContentLength?: boolean } = {}) => ({
  stream: new ReadableStream<Uint8Array>({
    start: controller => {
      controller.enqueue(bytes);
      controller.close();
    }
  }),
  size: opts.withContentLength === false ? undefined : bytes.byteLength
});

let unhashedFile = {
  oid: 1n,
  storeId: 'store_1',
  fileSize: content.byteLength,
  contentSha256: null as string | null,
  contentSha256StoreId: null as string | null,
  contentGitBlobSha: null as string | null,
  contentCrc32: null as bigint | null
};

let hashedFile = {
  ...unhashedFile,
  contentSha256: expected.sha256,
  contentSha256StoreId: 'store_1',
  contentGitBlobSha: expected.gitBlobSha,
  contentCrc32: BigInt(expected.crc32)
};

describe('getFileContentHashes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findPendingContent.mockResolvedValue(null);
    mocks.updateFiles.mockResolvedValue({ count: 1 });
    mocks.getObjectStream.mockImplementation(async () => objectStream(content));
  });

  it('returns cached hashes without reading the object', async () => {
    expect(await getFileContentHashes({ file: hashedFile })).toEqual({
      ...expected,
      pendingContent: null
    });
    expect(mocks.getObjectStream).not.toHaveBeenCalled();
    expect(mocks.updateFiles).not.toHaveBeenCalled();
  });

  it('treats hashes of another storeId or a sha256-only row as missing', () => {
    expect(hasValidContentHashes(hashedFile)).toBe(true);
    expect(hasValidContentHashes({ ...hashedFile, storeId: 'store_2' })).toBe(false);
    expect(
      hasValidContentHashes({ ...hashedFile, contentGitBlobSha: null, contentCrc32: null })
    ).toBe(false);
  });

  it('streams, hashes and persists guarded by storeId', async () => {
    expect(await getFileContentHashes({ file: unhashedFile })).toEqual({
      ...expected,
      pendingContent: null
    });

    expect(mocks.getObjectStream).toHaveBeenCalledWith('cargo-files', 'store_1');
    expect(mocks.updateFiles).toHaveBeenCalledWith({
      where: { oid: 1n, storeId: 'store_1' },
      data: {
        contentSha256: expected.sha256,
        contentSha256StoreId: 'store_1',
        contentGitBlobSha: expected.gitBlobSha,
        contentCrc32: BigInt(expected.crc32)
      }
    });
  });

  it('recomputes stale hashes after a storeId rewrite', async () => {
    let rewritten = { ...hashedFile, storeId: 'store_2' };

    await getFileContentHashes({ file: rewritten });

    expect(mocks.getObjectStream).toHaveBeenCalledWith('cargo-files', 'store_2');
    expect(mocks.updateFiles.mock.calls[0]![0].where).toEqual({ oid: 1n, storeId: 'store_2' });
  });

  it('leaves the row alone when storeId changed while hashing', async () => {
    mocks.updateFiles.mockResolvedValue({ count: 0 });

    expect((await getFileContentHashes({ file: unhashedFile })).gitBlobSha).toBe(
      expected.gitBlobSha
    );
    expect(mocks.updateFiles.mock.calls[0]![0].where.storeId).toBe('store_1');
  });

  it('hashes pending content without persisting or reading the object', async () => {
    let pending = new TextEncoder().encode('pending\n');
    mocks.findPendingContent.mockResolvedValue({ content: pending });

    let result = await getFileContentHashes({ file: unhashedFile });

    expect(result).toMatchObject(hashBytes(pending));
    expect(result.pendingContent).toEqual(Buffer.from(pending));
    expect(mocks.getObjectStream).not.toHaveBeenCalled();
    expect(mocks.updateFiles).not.toHaveBeenCalled();
  });

  it('retries with the real size when the object has no content length', async () => {
    let wrongSize = { ...unhashedFile, fileSize: 99 };
    mocks.getObjectStream.mockImplementation(async () =>
      objectStream(content, { withContentLength: false })
    );

    expect(await getFileContentHashes({ file: wrongSize })).toMatchObject(expected);
    expect(mocks.getObjectStream).toHaveBeenCalledTimes(2);
    expect(mocks.updateFiles).not.toHaveBeenCalled();
  });
});
