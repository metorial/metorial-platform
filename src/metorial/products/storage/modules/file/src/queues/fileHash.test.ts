import { hashBytes } from '@lowerdeck/hash/content';
import { ObjectStorageError } from 'object-storage-client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  findFile: vi.fn(),
  findFiles: vi.fn(),
  updateFiles: vi.fn(),
  findPendingContent: vi.fn(),
  getObjectStream: vi.fn(),
  queues: {} as Record<
    string,
    {
      add: ReturnType<typeof import('vitest').vi.fn>;
      addManyWithOps: ReturnType<typeof import('vitest').vi.fn>;
      handler?: (data: any) => Promise<void>;
    }
  >
}));

vi.mock('@metorial/db', () => ({
  db: {
    file: {
      findUnique: mocks.findFile,
      findMany: mocks.findFiles,
      updateMany: mocks.updateFiles,
      fields: { storeId: 'File.storeId' }
    },
    filePendingContent: { findUnique: mocks.findPendingContent }
  },
  withTransaction: async (cb: (db: unknown) => Promise<unknown>) => await cb({})
}));
vi.mock('@metorial/queue', async () => {
  let { vi } = await import('vitest');

  return {
    createQueue: (opts: { name: string }) => {
      let queue: (typeof mocks.queues)[string] = { add: vi.fn(), addManyWithOps: vi.fn() };
      mocks.queues[opts.name] = queue;

      return {
        ...queue,
        name: opts.name,
        process: (handler: (data: any) => Promise<void>) => {
          queue.handler = handler;
          return { name: opts.name };
        }
      };
    },
    combineQueueProcessors: (processors: unknown[]) => processors,
    pacedDelay: (d: { baseMs: number; jitterMs: number }) => ({ delay: d.baseMs })
  };
});
vi.mock('../storage', () => ({
  getCargoFilesBucketName: () => 'cargo-files',
  getStorage: () => ({}),
  getObjectStream: mocks.getObjectStream
}));

let { getFileHashJobId } = await import('./fileHash');

let hashQueue = () => mocks.queues['cargo/storage/file/hash']!;
let backfillQueue = () => mocks.queues['cargo/storage/file/hash-backfill']!;

let content = new TextEncoder().encode('hello\n');
let expected = hashBytes(content);

let file = {
  id: 'fil_1',
  oid: 1n,
  status: 'active',
  storeId: 'legacy_key',
  delegatorOid: null as bigint | null,
  fileSize: content.byteLength,
  contentSha256: null as string | null,
  contentSha256StoreId: null as string | null,
  contentGitBlobSha: null as string | null,
  contentCrc32: null as bigint | null
};

let objectStream = () => ({
  stream: new ReadableStream<Uint8Array>({
    start: controller => {
      controller.enqueue(content);
      controller.close();
    }
  }),
  size: content.byteLength
});

describe('cargo/storage/file/hash', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findPendingContent.mockResolvedValue(null);
    mocks.updateFiles.mockResolvedValue({ count: 1 });
    mocks.getObjectStream.mockImplementation(async () => objectStream());
  });

  it('streams, hashes and persists the stored object guarded by storeId', async () => {
    mocks.findFile.mockResolvedValue(file);

    await hashQueue().handler!({ fileId: file.id });

    expect(mocks.getObjectStream).toHaveBeenCalledWith('cargo-files', 'legacy_key');
    expect(mocks.updateFiles).toHaveBeenCalledWith({
      where: { oid: 1n, storeId: 'legacy_key' },
      data: {
        contentSha256: expected.sha256,
        contentSha256StoreId: 'legacy_key',
        contentGitBlobSha: expected.gitBlobSha,
        contentCrc32: BigInt(expected.crc32)
      }
    });
  });

  it('does nothing for missing, deleted, delegated, empty-key or already hashed files', async () => {
    for (let candidate of [
      null,
      { ...file, status: 'deleted' },
      { ...file, delegatorOid: 4n },
      { ...file, storeId: '' },
      {
        ...file,
        contentSha256: expected.sha256,
        contentSha256StoreId: 'legacy_key',
        contentGitBlobSha: expected.gitBlobSha,
        contentCrc32: BigInt(expected.crc32)
      }
    ]) {
      mocks.findFile.mockResolvedValueOnce(candidate);
      await hashQueue().handler!({ fileId: file.id });
    }

    expect(mocks.getObjectStream).not.toHaveBeenCalled();
    expect(mocks.updateFiles).not.toHaveBeenCalled();
  });

  it('rehashes when the cached hashes belong to another storeId', async () => {
    mocks.findFile.mockResolvedValue({
      ...file,
      contentSha256: 'stale',
      contentSha256StoreId: 'previous_key',
      contentGitBlobSha: 'stale',
      contentCrc32: 1n
    });

    await hashQueue().handler!({ fileId: file.id });

    expect(mocks.updateFiles).toHaveBeenCalledTimes(1);
  });

  it('does not persist hashes of pending content that is not at storeId yet', async () => {
    mocks.findFile.mockResolvedValue(file);
    mocks.findPendingContent.mockResolvedValue({ content: Buffer.from('pending') });

    await hashQueue().handler!({ fileId: file.id });

    expect(mocks.getObjectStream).not.toHaveBeenCalled();
    expect(mocks.updateFiles).not.toHaveBeenCalled();
  });

  it('gives up quietly on a missing object and retries other storage errors', async () => {
    mocks.findFile.mockResolvedValue(file);

    mocks.getObjectStream.mockRejectedValueOnce(new ObjectStorageError(404, 'not found'));
    await hashQueue().handler!({ fileId: file.id });

    mocks.getObjectStream.mockRejectedValueOnce(new ObjectStorageError(503, 'unavailable'));
    await expect(hashQueue().handler!({ fileId: file.id })).rejects.toMatchObject({
      statusCode: 503
    });

    expect(mocks.updateFiles).not.toHaveBeenCalled();
  });
});

describe('cargo/storage/file/hash-backfill', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  let page = (count: number, offset = 0) =>
    Array.from({ length: count }, (_, index) => ({
      id: `fil_${String(index + offset).padStart(4, '0')}`,
      storeId: `key_${index + offset}`
    }));

  it('selects active skill-store files with missing or stale hashes, one page at a time', async () => {
    mocks.findFiles.mockResolvedValue(page(3));

    await backfillQueue().handler!({ instanceId: 'ins_1', cursor: 'fil_0000' });

    let [args] = mocks.findFiles.mock.calls[0]!;
    expect(args).toMatchObject({
      where: {
        id: { gt: 'fil_0000' },
        status: 'active',
        storeId: { not: '' },
        delegatorOid: null,
        instance: { id: 'ins_1' },
        storeItems: { some: { store: { skill: { isNot: null } } } }
      },
      orderBy: { id: 'asc' },
      select: { id: true, storeId: true },
      take: 500
    });
    expect(args.where.OR).toEqual([
      { contentSha256: null },
      { contentGitBlobSha: null },
      { contentCrc32: null },
      { contentSha256StoreId: null },
      { NOT: { contentSha256StoreId: { equals: 'File.storeId' } } }
    ]);
  });

  it('fans out to the hash queue with job ids per stored object', async () => {
    let files = page(3);
    mocks.findFiles.mockResolvedValue(files);

    await backfillQueue().handler!({});

    expect(hashQueue().addManyWithOps).toHaveBeenCalledWith(
      files.map(file => ({ data: { fileId: file.id }, opts: { id: getFileHashJobId(file) } }))
    );
    expect(getFileHashJobId(files[0]!)).toBe('file-hash:fil_0000:key_0');
    expect(backfillQueue().add).not.toHaveBeenCalled();
  });

  it('re-enqueues itself with a paced delay only after a full page', async () => {
    mocks.findFiles.mockResolvedValueOnce(page(500));

    await backfillQueue().handler!({ instanceId: 'ins_1' });

    expect(backfillQueue().add).toHaveBeenCalledWith(
      { instanceId: 'ins_1', cursor: 'fil_0499' },
      { delay: 5_000 }
    );
  });

  it('stops on an empty page', async () => {
    mocks.findFiles.mockResolvedValue([]);

    await backfillQueue().handler!({});

    expect(hashQueue().addManyWithOps).not.toHaveBeenCalled();
    expect(backfillQueue().add).not.toHaveBeenCalled();
  });
});
