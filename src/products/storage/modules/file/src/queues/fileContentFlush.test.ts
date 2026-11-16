import { hashBytes } from '@lowerdeck/hash/content';
import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  findPending: vi.fn(),
  deletePending: vi.fn(),
  findFile: vi.fn(),
  updateFiles: vi.fn(),
  putObject: vi.fn(),
  cleanupDeletedFileStorage: vi.fn()
}));

vi.mock('@metorial/db', () => {
  let db = {
    filePendingContent: { findFirst: mocks.findPending, deleteMany: mocks.deletePending },
    file: { findUnique: mocks.findFile, updateMany: mocks.updateFiles }
  };

  return {
    db,
    withTransaction: async (cb: (db: unknown) => Promise<unknown>) => await cb(db)
  };
});
vi.mock('@metorial/cron', () => ({ createCron: () => ({}) }));
vi.mock('@metorial/queue', () => ({
  createQueue: () => ({ process: () => ({}) }),
  combineQueueProcessors: () => ({})
}));
vi.mock('../storage', () => ({
  getCargoFilesBucketName: () => 'cargo-files',
  getStorage: () => ({ putObject: mocks.putObject })
}));
vi.mock('./fileCleanup', () => ({
  cleanupDeletedFileStorage: mocks.cleanupDeletedFileStorage
}));

let { flushPendingFileContent } = await import('./fileContentFlush');

let content = new TextEncoder().encode('# Notes\n');
let hashes = hashBytes(content);
let casKey = `sha256/${hashes.sha256}`;

let pending = (file: Record<string, unknown>, bytes = content) => ({
  oid: 9n,
  revision: 1,
  flushAfter: new Date(Date.now() - 1000),
  content: Buffer.from(bytes),
  file: {
    id: 'fil_1',
    oid: 1n,
    status: 'active',
    fileType: 'text/markdown',
    fileSize: bytes.byteLength,
    contentSha256: null,
    contentSha256StoreId: null,
    contentGitBlobSha: null,
    contentCrc32: null,
    ...file
  }
});

describe('flushPendingFileContent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.putObject.mockResolvedValue({});
    mocks.findFile.mockResolvedValue({ status: 'active' });
    mocks.deletePending.mockResolvedValue({ count: 1 });
    mocks.updateFiles.mockResolvedValue({ count: 1 });
  });

  it('writes content-addressed pending content without per-file metadata', async () => {
    mocks.findPending.mockResolvedValue(
      pending({
        storeId: casKey,
        contentSha256: hashes.sha256,
        contentSha256StoreId: casKey,
        contentGitBlobSha: hashes.gitBlobSha,
        contentCrc32: BigInt(hashes.crc32)
      })
    );

    expect(await flushPendingFileContent({ fileId: 'fil_1' })).toBe(true);

    expect(mocks.putObject).toHaveBeenCalledWith(
      'cargo-files',
      casKey,
      new Uint8Array(content),
      'application/octet-stream'
    );
    expect(mocks.updateFiles).not.toHaveBeenCalled();
  });

  it('refuses to write pending content that does not match its content-addressed key', async () => {
    mocks.findPending.mockResolvedValue(
      pending({ storeId: casKey }, new TextEncoder().encode('# Changed\n'))
    );

    await expect(flushPendingFileContent({ fileId: 'fil_1' })).rejects.toThrow(
      /does not match/
    );

    expect(mocks.putObject).not.toHaveBeenCalled();
    expect(mocks.deletePending).not.toHaveBeenCalled();
  });

  it('persists hashes for legacy keys once the content is flushed', async () => {
    mocks.findPending.mockResolvedValue(pending({ storeId: 'legacy_key' }));

    expect(await flushPendingFileContent({ fileId: 'fil_1' })).toBe(true);

    expect(mocks.putObject).toHaveBeenCalledWith(
      'cargo-files',
      'legacy_key',
      new Uint8Array(content),
      'text/markdown'
    );
    expect(mocks.updateFiles).toHaveBeenCalledWith({
      where: { oid: 1n, storeId: 'legacy_key' },
      data: {
        contentSha256: hashes.sha256,
        contentSha256StoreId: 'legacy_key',
        contentGitBlobSha: hashes.gitBlobSha,
        contentCrc32: BigInt(hashes.crc32)
      }
    });
  });

  it('does not persist hashes when a newer revision superseded the flush', async () => {
    mocks.findPending.mockResolvedValue(pending({ storeId: 'legacy_key' }));
    mocks.deletePending.mockResolvedValue({ count: 0 });

    expect(await flushPendingFileContent({ fileId: 'fil_1' })).toBe(false);

    expect(mocks.updateFiles).not.toHaveBeenCalled();
  });

  it('hands the object to guarded cleanup when the file was deleted during the flush', async () => {
    mocks.findPending.mockResolvedValue(pending({ storeId: casKey }));
    mocks.findFile.mockResolvedValue({ status: 'deleted' });

    expect(await flushPendingFileContent({ fileId: 'fil_1' })).toBe(false);

    expect(mocks.cleanupDeletedFileStorage).toHaveBeenCalledWith({
      fileId: 'fil_1',
      storeId: casKey
    });
    expect(mocks.updateFiles).not.toHaveBeenCalled();
  });
});
