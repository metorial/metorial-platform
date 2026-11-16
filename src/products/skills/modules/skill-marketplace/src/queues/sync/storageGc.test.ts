import { beforeEach, describe, expect, it, vi } from 'vitest';

let { events, db, storage, queues } = vi.hoisted(() => {
  let events: string[] = [];
  let queues = new Map<string, { add: any; addMany: any; addManyWithOps: any }>();

  let db = {
    $executeRaw: vi.fn(async (_strings: TemplateStringsArray, keys: string[]) => {
      events.push(`lock:${keys.join(',')}`);
    }),
    skillSyncBlob: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(async () => events.push('delete-row'))
    },
    skillDestinationFile: { findFirst: vi.fn() },
    skillDestinationManifest: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      delete: vi.fn(async () => events.push('delete-row'))
    }
  };

  let storage = {
    deleteObject: vi.fn(async (_bucket: string, key: string) => events.push(`delete:${key}`)),
    listObjectsPage: vi.fn()
  };

  return { events, db, storage, queues };
});

vi.mock('@metorial/db', () => ({
  db,
  withTransaction: async (run: (tx: typeof db) => unknown) => run(db)
}));
vi.mock('@metorial/module-file', () => ({
  getCargoFilesBucketName: () => 'files',
  getStorage: () => storage,
  getObjectStream: vi.fn()
}));
vi.mock('@metorial/cron', () => ({
  createCron: (_opts: unknown, handler: () => Promise<void>) => handler
}));
vi.mock('@metorial/queue', () => ({
  dailyPacedDelay: () => ({ delay: 1 }),
  createQueue: ({ name }: { name: string }) => {
    let queue = { add: vi.fn(), addMany: vi.fn(), addManyWithOps: vi.fn() };
    queues.set(name, queue);
    return { ...queue, process: (run: unknown) => run };
  }
}));
vi.mock('../../env', () => ({
  env: {
    skillSync: {
      SKILL_SYNC_BLOB_RETENTION: 7 * 24 * 3600,
      SKILL_SYNC_MANIFEST_RETENTION: 7 * 24 * 3600,
      SKILL_SYNC_MANIFEST_KEEP_LAST: 2
    }
  }
}));

import {
  skillSyncBlobGcCron,
  skillSyncBlobGcManyQueueProcessor,
  skillSyncBlobGcSingleQueueProcessor,
  skillSyncManifestGcManyQueueProcessor,
  skillSyncManifestGcSingleQueueProcessor,
  skillSyncObjectSweepCron,
  skillSyncObjectSweepManyQueueProcessor,
  skillSyncObjectSweepSingleQueueProcessor
} from './storageGc';

let call = <T>(processor: unknown) => processor as (data: T) => Promise<void>;
let queue = (name: string) => queues.get(name)!;

let day = 24 * 3600 * 1000;
let daysAgo = (days: number) => new Date(Date.now() - days * day);
let blobKey = 'skill-sync/blobs/sha256/abc';
let manifestKey = 'skill-sync/manifests/sdst_1/abc.ndjson';

describe('blob gc', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    events.length = 0;
  });

  it('starts blob and manifest collection from the daily cron', async () => {
    await (skillSyncBlobGcCron as unknown as () => Promise<void>)();

    expect(queue('cargo/skill/sync/blob-gc/many').add).toHaveBeenCalledWith({});
    expect(queue('cargo/skill/sync/manifest-gc/many').add).toHaveBeenCalledWith({});
  });

  it('pages over blobs older than the retention and only re-enqueues on a full page', async () => {
    db.skillSyncBlob.findMany.mockResolvedValueOnce(
      Array.from({ length: 500 }, (_, i) => ({ oid: BigInt(i + 1), key: `k${i}` }))
    );

    await call<{ cursor?: string; retentionSeconds?: number }>(
      skillSyncBlobGcManyQueueProcessor
    )({
      retentionSeconds: 0
    });

    let { where } = db.skillSyncBlob.findMany.mock.calls[0]![0];
    expect(where.lastReferencedAt.lt.getTime()).toBeGreaterThan(Date.now() - 1000);
    expect(queue('cargo/skill/sync/blob-gc/single').addManyWithOps).toHaveBeenCalledWith(
      expect.arrayContaining([
        { data: { key: 'k0', retentionSeconds: 0 }, opts: { id: 'blob-gc:1' } }
      ])
    );
    expect(queue('cargo/skill/sync/blob-gc/many').add).toHaveBeenCalledWith(
      { cursor: '500', retentionSeconds: 0 },
      { delay: 1 }
    );

    db.skillSyncBlob.findMany.mockResolvedValueOnce([{ oid: 501n, key: 'k500' }]);
    vi.mocked(queue('cargo/skill/sync/blob-gc/many').add).mockClear();

    await call<{ cursor?: string }>(skillSyncBlobGcManyQueueProcessor)({ cursor: '500' });

    expect(db.skillSyncBlob.findMany.mock.calls[1]![0].where.oid).toEqual({ gt: 500n });
    expect(queue('cargo/skill/sync/blob-gc/many').add).not.toHaveBeenCalled();
  });

  it('deletes an unreferenced old blob object and row under its lock', async () => {
    db.skillSyncBlob.findUnique.mockResolvedValue({
      oid: 1n,
      key: blobKey,
      lastReferencedAt: daysAgo(8)
    });
    db.skillDestinationFile.findFirst.mockResolvedValue(null);

    await call<{ key: string }>(skillSyncBlobGcSingleQueueProcessor)({ key: blobKey });

    expect(events).toEqual([
      `lock:skill-sync-object:${blobKey}`,
      `delete:${blobKey}`,
      'delete-row'
    ]);
    expect(db.skillDestinationFile.findFirst).toHaveBeenCalledWith({
      where: { sourceKey: blobKey },
      select: { oid: true }
    });
  });

  it('keeps a blob a writer touched after it was listed', async () => {
    db.skillSyncBlob.findUnique.mockResolvedValue({
      oid: 1n,
      key: blobKey,
      lastReferencedAt: daysAgo(1)
    });

    await call<{ key: string }>(skillSyncBlobGcSingleQueueProcessor)({ key: blobKey });

    expect(storage.deleteObject).not.toHaveBeenCalled();
    expect(db.skillSyncBlob.delete).not.toHaveBeenCalled();
  });

  it('keeps a still-referenced blob and refreshes it so it is not listed again tomorrow', async () => {
    db.skillSyncBlob.findUnique.mockResolvedValue({
      oid: 1n,
      key: blobKey,
      lastReferencedAt: daysAgo(30)
    });
    db.skillDestinationFile.findFirst.mockResolvedValue({ oid: 9n });

    await call<{ key: string }>(skillSyncBlobGcSingleQueueProcessor)({ key: blobKey });

    expect(storage.deleteObject).not.toHaveBeenCalled();
    expect(db.skillSyncBlob.update).toHaveBeenCalledWith({
      where: { oid: 1n },
      data: { lastReferencedAt: expect.any(Date) }
    });
  });

  it('honors a zero retention override', async () => {
    db.skillSyncBlob.findUnique.mockResolvedValue({
      oid: 1n,
      key: blobKey,
      lastReferencedAt: new Date(Date.now() - 50)
    });
    db.skillDestinationFile.findFirst.mockResolvedValue(null);

    await call<{ key: string; retentionSeconds?: number }>(
      skillSyncBlobGcSingleQueueProcessor
    )({
      key: blobKey,
      retentionSeconds: 0
    });

    expect(storage.deleteObject).toHaveBeenCalledWith('files', blobKey);
  });

  it('treats an already-missing object as deleted', async () => {
    db.skillSyncBlob.findUnique.mockResolvedValue({
      oid: 1n,
      key: blobKey,
      lastReferencedAt: daysAgo(8)
    });
    db.skillDestinationFile.findFirst.mockResolvedValue(null);
    storage.deleteObject.mockRejectedValueOnce(
      Object.assign(new Error('gone'), { statusCode: 404 })
    );

    await call<{ key: string }>(skillSyncBlobGcSingleQueueProcessor)({ key: blobKey });

    expect(db.skillSyncBlob.delete).toHaveBeenCalled();
  });
});

describe('manifest gc', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    events.length = 0;
  });

  it('only lists manifests nothing points at', async () => {
    db.skillDestinationManifest.findMany.mockResolvedValue([{ oid: 3n }]);

    await call<{ cursor?: string }>(skillSyncManifestGcManyQueueProcessor)({});

    expect(db.skillDestinationManifest.findMany.mock.calls[0]![0].where).toMatchObject({
      currentForDestinations: { none: {} },
      lastPropagatedRepos: { none: {} },
      syncs: { none: { status: { in: ['pending', 'processing', 'waiting_for_review'] } } },
      propagations: {
        none: { status: { in: ['pending', 'processing', 'waiting_for_review'] } }
      },
      exportRefs: {
        none: {
          file: {
            is: {
              status: 'active',
              OR: [{ expiresAt: null }, { expiresAt: { gt: expect.any(Date) } }],
              skillExports: { some: { status: { not: 'failed' } } }
            }
          }
        }
      }
    });
    expect(queue('cargo/skill/sync/manifest-gc/single').addManyWithOps).toHaveBeenCalledWith([
      {
        data: { manifestOid: '3', retentionSeconds: undefined },
        opts: { id: 'manifest-gc:3' }
      }
    ]);
  });

  it('deletes a collectable manifest that is not among the newest per destination', async () => {
    db.skillDestinationManifest.findUnique.mockResolvedValue({ objectKey: manifestKey });
    db.skillDestinationManifest.findFirst.mockResolvedValue({
      oid: 3n,
      destinationOid: 1n,
      objectKey: manifestKey
    });
    db.skillDestinationManifest.findMany.mockResolvedValue([{ oid: 5n }, { oid: 4n }]);

    await call<{ manifestOid: string }>(skillSyncManifestGcSingleQueueProcessor)({
      manifestOid: '3'
    });

    expect(events).toEqual([
      `lock:skill-sync-object:${manifestKey}`,
      `delete:${manifestKey}`,
      'delete-row'
    ]);
    expect(db.skillDestinationManifest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { destinationOid: 1n }, take: 2 })
    );
  });

  it('keeps one of the newest manifests of its destination', async () => {
    db.skillDestinationManifest.findUnique.mockResolvedValue({ objectKey: manifestKey });
    db.skillDestinationManifest.findFirst.mockResolvedValue({
      oid: 4n,
      destinationOid: 1n,
      objectKey: manifestKey
    });
    db.skillDestinationManifest.findMany.mockResolvedValue([{ oid: 5n }, { oid: 4n }]);

    await call<{ manifestOid: string }>(skillSyncManifestGcSingleQueueProcessor)({
      manifestOid: '4'
    });

    expect(storage.deleteObject).not.toHaveBeenCalled();
  });

  it('keeps a manifest that became referenced after it was listed', async () => {
    db.skillDestinationManifest.findUnique.mockResolvedValue({ objectKey: manifestKey });
    db.skillDestinationManifest.findFirst.mockResolvedValue(null);

    await call<{ manifestOid: string }>(skillSyncManifestGcSingleQueueProcessor)({
      manifestOid: '3'
    });

    expect(storage.deleteObject).not.toHaveBeenCalled();
    expect(db.skillDestinationManifest.delete).not.toHaveBeenCalled();
  });
});

describe('object sweep', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    events.length = 0;
    db.skillSyncBlob.findMany.mockResolvedValue([]);
    db.skillDestinationManifest.findMany.mockResolvedValue([]);
  });

  it('sweeps both prefixes weekly', async () => {
    await (skillSyncObjectSweepCron as unknown as () => Promise<void>)();

    expect(queue('cargo/skill/sync/object-sweep/many').addMany).toHaveBeenCalledWith([
      { prefix: 'skill-sync/blobs/sha256/' },
      { prefix: 'skill-sync/manifests/' }
    ]);
  });

  it('enqueues old objects without a row and follows the continuation token', async () => {
    storage.listObjectsPage.mockResolvedValue({
      objects: [
        { key: `${blobKey}1`, last_modified: daysAgo(30).toISOString() },
        { key: `${blobKey}2`, last_modified: daysAgo(30).toISOString() },
        { key: `${blobKey}3`, last_modified: new Date().toISOString() }
      ],
      nextContinuationToken: 'next'
    });
    db.skillSyncBlob.findMany.mockResolvedValue([{ key: `${blobKey}2` }]);

    await call<{ prefix: string }>(skillSyncObjectSweepManyQueueProcessor)({
      prefix: 'skill-sync/blobs/sha256/'
    });

    expect(storage.listObjectsPage).toHaveBeenCalledWith(
      'files',
      'skill-sync/blobs/sha256/',
      500,
      undefined
    );
    expect(queue('cargo/skill/sync/object-sweep/single').addMany).toHaveBeenCalledWith([
      { key: `${blobKey}1`, retentionSeconds: undefined }
    ]);
    expect(queue('cargo/skill/sync/object-sweep/many').add).toHaveBeenCalledWith(
      {
        prefix: 'skill-sync/blobs/sha256/',
        continuationToken: 'next',
        retentionSeconds: undefined
      },
      { delay: 1 }
    );
  });

  it('checks manifest objects against manifest rows', async () => {
    storage.listObjectsPage.mockResolvedValue({
      objects: [{ key: manifestKey, last_modified: daysAgo(30).toISOString() }]
    });
    db.skillDestinationManifest.findMany.mockResolvedValue([{ objectKey: manifestKey }]);

    await call<{ prefix: string }>(skillSyncObjectSweepManyQueueProcessor)({
      prefix: 'skill-sync/manifests/'
    });

    expect(queue('cargo/skill/sync/object-sweep/single').addMany).not.toHaveBeenCalled();
    expect(queue('cargo/skill/sync/object-sweep/many').add).not.toHaveBeenCalled();
  });

  it('refuses prefixes it does not own but accepts narrower ones', async () => {
    await call<{ prefix: string }>(skillSyncObjectSweepManyQueueProcessor)({
      prefix: 'files/'
    });
    await call<{ prefix: string }>(skillSyncObjectSweepManyQueueProcessor)({
      prefix: 'skill-sync/'
    });
    await call<{ key: string }>(skillSyncObjectSweepSingleQueueProcessor)({ key: 'files/x' });

    expect(storage.listObjectsPage).not.toHaveBeenCalled();
    expect(storage.deleteObject).not.toHaveBeenCalled();

    storage.listObjectsPage.mockResolvedValue({ objects: [] });
    await call<{ prefix: string }>(skillSyncObjectSweepManyQueueProcessor)({
      prefix: 'skill-sync/manifests/sdst_1/'
    });
    expect(storage.listObjectsPage).toHaveBeenCalledWith(
      'files',
      'skill-sync/manifests/sdst_1/',
      500,
      undefined
    );
  });

  it('deletes an orphan under its lock unless a row appeared meanwhile', async () => {
    await call<{ key: string }>(skillSyncObjectSweepSingleQueueProcessor)({ key: blobKey });
    expect(events).toEqual([`lock:skill-sync-object:${blobKey}`, `delete:${blobKey}`]);

    events.length = 0;
    db.skillSyncBlob.findMany.mockResolvedValue([{ key: blobKey }]);
    await call<{ key: string }>(skillSyncObjectSweepSingleQueueProcessor)({ key: blobKey });
    expect(events).toEqual([`lock:skill-sync-object:${blobKey}`]);
  });
});
