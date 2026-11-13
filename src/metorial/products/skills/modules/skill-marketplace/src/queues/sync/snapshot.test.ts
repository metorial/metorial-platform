import { existsSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

type FileRow = {
  path: string;
  itemKey: string | null;
  gitBlobSha: string | null;
  sha256: string | null;
  byteSize: bigint | null;
  crc32: bigint | null;
  sourceKey: string | null;
};

let { state, db, storage, spooledUploads, propagate, finish, log, report, unchangedSync } =
  vi.hoisted(() => {
    let state = {
      files: [] as FileRow[],
      items: [] as any[],
      manifests: [] as any[],
      sync: {} as any,
      queries: [] as string[],
      maxEntries: undefined as number | undefined
    };

    let isIncomplete = (file: FileRow) =>
      [file.gitBlobSha, file.sha256, file.byteSize, file.crc32, file.sourceKey].includes(null);

    let db = {
      skillDestinationSync: {
        findUnique: vi.fn(async () => state.sync),
        update: vi.fn(async () => ({})),
        updateMany: vi.fn(async () => ({ count: 1 }))
      },
      skillDestinationFile: {
        findMany: vi.fn(async () => state.files.filter(isIncomplete).slice(0, 10)),
        count: vi.fn(async () => state.files.filter(isIncomplete).length),
        aggregate: vi.fn(async () => ({
          _count: { _all: state.files.length },
          _sum: {
            byteSize: state.files.length
              ? state.files.reduce((sum, file) => sum + (file.byteSize ?? 0n), 0n)
              : null
          }
        }))
      },
      skillDestinationItem: {
        findMany: vi.fn(async () => state.items),
        count: vi.fn(async () => state.items.length),
        updateMany: vi.fn(async () => ({}))
      },
      skillDestinationManifest: {
        findUnique: vi.fn(
          async ({ where }: any) =>
            state.manifests.find(
              manifest => manifest.sha256 === where.destinationOid_sha256.sha256
            ) ?? null
        ),
        update: vi.fn(async ({ where }: any) =>
          state.manifests.find(manifest => manifest.oid === where.oid)
        ),
        create: vi.fn(async ({ data }: any) => {
          let manifest = { oid: BigInt(state.manifests.length + 1), ...data };
          state.manifests.push(manifest);
          return manifest;
        })
      },
      skillDestination: { update: vi.fn(async () => ({})) },
      $executeRaw: vi.fn(async (_strings: TemplateStringsArray, ..._values: unknown[]) => 0),
      $queryRaw: vi.fn(async (strings: TemplateStringsArray, ...values: unknown[]) => {
        state.queries.push(strings.join('?'));
        let cursor = values.length === 3 ? Buffer.from(values[1] as Uint8Array) : null;
        let limit = values.at(-1) as number;

        return state.files
          .map(file => ({ ...file, pathBytes: Buffer.from(file.path.normalize('NFC')) }))
          .filter(file => !cursor || Buffer.compare(file.pathBytes, cursor) > 0)
          .sort((a, b) => Buffer.compare(a.pathBytes, b.pathBytes))
          .slice(0, limit);
      })
    };

    let storage = {
      objects: new Map<string, Buffer>(),
      putObject: vi.fn(async (_bucket: string, key: string, body: Buffer) => {
        storage.objects.set(key, body);
      }),
      headObject: vi.fn(async (_bucket: string, key: string) => {
        if (!storage.objects.has(key))
          throw Object.assign(new Error('missing'), { statusCode: 404 });
        return { key };
      })
    };

    let spooledUploads = {
      paths: [] as string[],
      fail: false,
      putObjectFile: vi.fn(async (d: { key: string; path: string }) => {
        spooledUploads.paths.push(d.path);
        if (spooledUploads.fail) throw new Error('upload failed');
        let { readFile } = await import('node:fs/promises');
        storage.objects.set(d.key, await readFile(d.path));
      })
    };

    return {
      state,
      db,
      storage,
      spooledUploads,
      propagate: vi.fn(),
      finish: vi.fn(),
      log: vi.fn(),
      report: vi.fn(),
      unchangedSync: {
        canSkipUnchangedSync: vi.fn((d: { hasChanges: boolean }) => !d.hasChanges),
        areManifestRepositoriesCurrent: vi.fn(async () => false),
        finishUnchangedSync: vi.fn()
      }
    };
  });

vi.mock('@metorial/db', () => ({
  db,
  ID: { generateId: async () => 'sdm_1' },
  withTransaction: async (run: (tx: typeof db) => unknown) => run(db)
}));
vi.mock('@metorial/module-file', () => ({
  getCargoFilesBucketName: () => 'files',
  getStorage: () => storage,
  getObjectStream: vi.fn(),
  putObjectFile: spooledUploads.putObjectFile
}));
vi.mock('@metorial/queue', () => ({
  createQueue: () => ({ process: (run: unknown) => run })
}));
vi.mock('./_lib/lock', () => ({ withDestinationSyncLock: (run: unknown) => run }));
vi.mock('./_lib/logs', () => ({ appendSkillDestinationSyncLog: log }));
vi.mock('./_lib/report', () => ({ reportSkillSyncIssue: report }));
vi.mock('./finish', () => ({ syncFinishQueue: { add: finish } }));
vi.mock('./propagate', () => ({ syncPropagateStartQueue: { add: propagate } }));
vi.mock('./_lib/unchangedSync', () => unchangedSync);
vi.mock('../../lib/manifestFile/format', async importOriginal => {
  let actual = await importOriginal<typeof import('../../lib/manifestFile/format')>();
  return {
    ...actual,
    manifestFormatLimits: new Proxy(actual.manifestFormatLimits, {
      get: (limits, key) =>
        key === 'maxEntries' && state.maxEntries !== undefined
          ? state.maxEntries
          : limits[key as keyof typeof limits]
    })
  };
});

import { readManifestFile } from '../../lib/manifestFile/reader';
import { syncSnapshotQueueProcessor } from './snapshot';

let run = syncSnapshotQueueProcessor as unknown as (data: {
  skillDestinationSyncId: string;
  contentVersion?: number;
}) => Promise<void>;

let hex = (seed: string, length: number) => seed.repeat(length).slice(0, length);

let file = (path: string, seed = 'a', itemKey = 'skill:s:p'): FileRow => ({
  path,
  itemKey,
  gitBlobSha: hex(seed, 40),
  sha256: hex(seed, 64),
  byteSize: 3n,
  crc32: 9n,
  sourceKey: `skill-sync/blobs/sha256/${hex(seed, 64)}`
});

let destination = (overrides: Record<string, unknown> = {}) => ({
  oid: 1n,
  id: 'sdst_1',
  storageMode: 'manifest',
  currentManifestOid: null,
  currentManifest: null,
  skillMarketplace: { id: 'mkt_1', status: 'active' },
  skillPlugin: null,
  ...overrides
});

let start = () => run({ skillDestinationSyncId: 'sync_1', contentVersion: 2 });

describe('sync snapshot', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.files = [];
    state.items = [];
    state.manifests = [];
    state.queries = [];
    state.maxEntries = undefined;
    storage.objects.clear();
    spooledUploads.paths = [];
    spooledUploads.fail = false;
    state.sync = {
      oid: 7n,
      status: 'processing',
      isAtRepoSyncStage: false,
      contentVersion: 2,
      destination: destination()
    };
  });

  it('writes the manifest in byte order, records it and hands off to propagation', async () => {
    state.files = [
      file('plugins/b/x.md', 'b'),
      file('plugins/B/x.md', 'c'),
      file('plugins/é.md')
    ];

    await start();

    expect(db.$executeRaw.mock.calls[0]![0].join('?')).toContain('"pathBytes" IS NULL');
    expect(state.queries.every(query => query.includes('ORDER BY "pathBytes"'))).toBe(true);
    expect(state.manifests).toHaveLength(1);
    let [manifest] = state.manifests;
    let body = storage.objects.get(manifest.objectKey)!;
    let read = await readManifestFile(body, { expectedSha256: manifest.sha256 });

    expect(read.header).toMatchObject({
      destinationId: 'sdst_1',
      entryCount: 3,
      totalBytes: 9
    });
    expect(read.entries.map(entry => entry.path)).toEqual([
      'plugins/B/x.md',
      'plugins/b/x.md',
      'plugins/é.md'
    ]);
    expect(read.entries[0]).toMatchObject({
      gitBlobSha: hex('c', 40),
      sha256: hex('c', 64),
      size: 3,
      crc32: 9,
      key: `skill-sync/blobs/sha256/${hex('c', 64)}`
    });
    expect(manifest).toMatchObject({ entryCount: 3, totalBytes: 9n, destinationOid: 1n });
    expect(db.skillDestination.update).toHaveBeenCalledWith({
      where: { oid: 1n },
      data: { currentManifestOid: manifest.oid }
    });
    expect(db.skillDestinationSync.update).toHaveBeenCalledWith({
      where: { oid: 7n },
      data: { manifestOid: manifest.oid }
    });
    let [uploadOrder] = storage.putObject.mock.invocationCallOrder;
    expect(uploadOrder).toBeLessThan(db.skillDestination.update.mock.invocationCallOrder[0]!);
    expect(uploadOrder).toBeLessThan(
      db.skillDestinationSync.update.mock.invocationCallOrder[0]!
    );
    expect(propagate).toHaveBeenCalledWith({
      skillDestinationSyncId: 'sync_1',
      contentVersion: 2,
      skillRepositoryId: undefined
    });
  });

  it('pages through more rows than one query returns', async () => {
    state.files = Array.from({ length: 2_500 }, (_, i) =>
      file(`skills/s/${String(i).padStart(5, '0')}.md`)
    );

    await start();

    let [manifest] = state.manifests;
    let read = await readManifestFile(storage.objects.get(manifest.objectKey)!);
    expect(read.entries).toHaveLength(2_500);
    expect(db.$queryRaw).toHaveBeenCalledTimes(3);
    expect(storage.putObject).toHaveBeenCalledOnce();
    expect(spooledUploads.putObjectFile).not.toHaveBeenCalled();
  });

  describe('above 10,000 entries', () => {
    let manyFiles = () =>
      Array.from({ length: 10_001 }, (_, i) =>
        file(`skills/s/${String(i).padStart(5, '0')}.md`)
      );

    it('spools the manifest to disk, uploads it from there and removes the file', async () => {
      state.files = manyFiles();

      await start();

      let [manifest] = state.manifests;
      let read = await readManifestFile(storage.objects.get(manifest.objectKey)!, {
        expectedSha256: manifest.sha256
      });
      expect(read.entries).toHaveLength(10_001);
      expect(storage.putObject).not.toHaveBeenCalled();
      expect(spooledUploads.putObjectFile).toHaveBeenCalledWith({
        bucket: 'files',
        key: manifest.objectKey,
        path: spooledUploads.paths[0],
        contentType: 'application/gzip'
      });
      expect(existsSync(spooledUploads.paths[0]!)).toBe(false);
      expect(propagate).toHaveBeenCalledOnce();
    });

    it('removes the spooled file and publishes nothing when the upload fails', async () => {
      state.files = manyFiles();
      spooledUploads.fail = true;

      await expect(start()).rejects.toThrow('upload failed');

      expect(spooledUploads.paths).toHaveLength(1);
      expect(existsSync(spooledUploads.paths[0]!)).toBe(false);
      expect(db.skillDestination.update).not.toHaveBeenCalled();
      expect(db.skillDestinationSync.update).not.toHaveBeenCalled();
      expect(propagate).not.toHaveBeenCalled();
    });
  });

  it('produces the same manifest for unchanged content without a new row or upload', async () => {
    state.files = [file('skills/s/a.md'), file('skills/s/b.md', 'b')];
    await start();
    let [first] = state.manifests;

    state.files = [...state.files].reverse();
    state.sync.destination = destination({ currentManifestOid: first.oid });
    storage.putObject.mockClear();
    log.mockClear();

    await start();

    expect(state.manifests).toHaveLength(1);
    expect(db.skillDestinationManifest.create).toHaveBeenCalledOnce();
    expect(storage.putObject).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledWith('sync_1', expect.stringContaining('unchanged'));
    expect(propagate).toHaveBeenCalledTimes(2);
  });

  it('finishes without repository updates when the manifest is unchanged and every repository has it', async () => {
    state.files = [file('skills/s/a.md')];
    await start();
    let [first] = state.manifests;
    expect(unchangedSync.areManifestRepositoriesCurrent).not.toHaveBeenCalled();

    state.sync.destination = destination({ currentManifestOid: first.oid });
    unchangedSync.areManifestRepositoriesCurrent.mockResolvedValueOnce(true);
    propagate.mockClear();

    await start();

    expect(unchangedSync.areManifestRepositoriesCurrent).toHaveBeenCalledWith(
      expect.objectContaining({ destinationOid: 1n, manifestSha256: first.sha256 })
    );
    expect(unchangedSync.finishUnchangedSync).toHaveBeenCalledWith({
      syncOid: 7n,
      skillDestinationSyncId: 'sync_1'
    });
    expect(db.skillDestinationSync.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { manifestOid: first.oid } })
    );
    expect(propagate).not.toHaveBeenCalled();
  });

  it('re-uploads an existing manifest whose object is missing', async () => {
    state.files = [file('skills/s/a.md')];
    await start();
    storage.objects.clear();

    await start();

    expect(storage.putObject).toHaveBeenCalledTimes(2);
    expect(storage.objects.size).toBe(1);
  });

  it('fails instead of publishing rows without hashes and makes their items re-apply', async () => {
    state.files = [file('skills/s/a.md'), { ...file('skills/s/b.md'), sha256: null }];
    state.items = [
      { oid: 5n, skill: { id: 's' }, skillPlugin: { id: 'p' }, skillMarketplace: null },
      { oid: 6n, skill: { id: 'other' }, skillPlugin: { id: 'p' }, skillMarketplace: null }
    ];

    await start();

    expect(db.skillDestinationItem.updateMany).toHaveBeenCalledWith({
      where: { oid: { in: [5n] } },
      data: { hash: '' }
    });
    expect(db.skillDestinationSync.updateMany).toHaveBeenCalledWith({
      where: { oid: 7n, status: 'processing' },
      data: { status: 'failed', completedAt: expect.any(Date) }
    });
    expect(log).toHaveBeenCalledWith('sync_1', expect.stringContaining('manifest_incomplete'));
    expect(report).toHaveBeenCalledWith(
      expect.objectContaining({
        issue: 'snapshot_failed',
        errorCode: 'manifest_incomplete',
        skillDestinationSyncId: 'sync_1'
      })
    );
    expect(state.manifests).toEqual([]);
    expect(propagate).not.toHaveBeenCalled();
  });

  it('fails when the destination has more entries than a manifest may hold', async () => {
    state.maxEntries = 5;
    state.files = Array.from({ length: 6 }, (_, i) => file(`skills/s/${i}.md`));

    await start();

    expect(log).toHaveBeenCalledWith(
      'sync_1',
      expect.stringContaining('destination_too_large')
    );
    expect(report).not.toHaveBeenCalled();
    expect(db.$queryRaw).not.toHaveBeenCalled();
    expect(propagate).not.toHaveBeenCalled();
  });

  it.each<
    [
      string,
      {
        items?: { oid: bigint; skillMarketplace: { id: string } }[];
        previousEntryCount?: number;
      }
    ]
  >([
    ['live items', { items: [{ oid: 1n, skillMarketplace: { id: 'mkt_1' } }] }],
    ['a non-empty previous manifest', { previousEntryCount: 4 }]
  ])('refuses an empty manifest when the destination has %s', async (_, d) => {
    state.items = d.items ?? [];
    state.sync.destination = destination({
      currentManifest: d.previousEntryCount ? { entryCount: d.previousEntryCount } : null
    });

    await start();

    expect(log).toHaveBeenCalledWith('sync_1', expect.stringContaining('empty_manifest'));
    expect(report).toHaveBeenCalledWith(
      expect.objectContaining({ issue: 'snapshot_failed', errorCode: 'empty_manifest' })
    );
    expect(propagate).not.toHaveBeenCalled();
    expect(finish).not.toHaveBeenCalled();
  });

  it('finishes a destination that never had content without publishing', async () => {
    await start();

    expect(db.skillDestinationSync.update).toHaveBeenCalledWith({
      where: { oid: 7n },
      data: { isAtRepoSyncStage: true }
    });
    expect(finish).toHaveBeenCalledWith({ skillDestinationSyncId: 'sync_1' });
    expect(state.manifests).toEqual([]);
  });

  it('cancels an archived marketplace with a leftover item before building a manifest', async () => {
    state.items = [{ oid: 1n, skillMarketplace: { id: 'mkt_1' } }];
    state.sync.destination = destination({
      skillMarketplace: { id: 'mkt_1', status: 'archived' }
    });

    await start();

    expect(db.skillDestinationSync.update).toHaveBeenCalledExactlyOnceWith({
      where: { oid: 7n },
      data: { status: 'canceled', completedAt: expect.any(Date) }
    });
    expect(report).not.toHaveBeenCalled();
    expect(propagate).not.toHaveBeenCalled();
  });

  it.each([
    ['a stale content version', { contentVersion: 3 }],
    [
      'a code-bucket destination',
      { destination: destination({ storageMode: 'code_bucket' }) }
    ],
    ['a sync past the content stage', { isAtRepoSyncStage: true }],
    ['a canceled sync', { status: 'canceled' }]
  ])('ignores %s', async (_, overrides) => {
    state.files = [file('skills/s/a.md')];
    Object.assign(state.sync, overrides);

    await start();

    expect(db.skillDestinationFile.aggregate).not.toHaveBeenCalled();
    expect(propagate).not.toHaveBeenCalled();
  });
});
