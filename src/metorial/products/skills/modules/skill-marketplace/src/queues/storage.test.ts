import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let {
  db,
  add,
  addManyWithOps,
  fire,
  forceSkillDestinationSync,
  requestContentHashes,
  isFlagEnabledForInstance,
  getMany,
  deleteCodeBucket
} = vi.hoisted(() => ({
  db: {
    skillDestination: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn()
    },
    skillDestinationSync: { findFirst: vi.fn() },
    skillDestinationSyncRepositoryPropagation: { findFirst: vi.fn() },
    skillDestinationDeletedFile: { findFirst: vi.fn() },
    skillDestinationFile: { findMany: vi.fn(), count: vi.fn() },
    skillDestinationItem: { updateMany: vi.fn() },
    file: { findMany: vi.fn() },
    $executeRaw: vi.fn()
  },
  add: vi.fn(),
  addManyWithOps: vi.fn(),
  fire: vi.fn(),
  forceSkillDestinationSync: vi.fn(),
  requestContentHashes: vi.fn(),
  isFlagEnabledForInstance: vi.fn(),
  getMany: vi.fn(),
  deleteCodeBucket: vi.fn()
}));

vi.mock('@metorial/db', () => ({
  db,
  withTransaction: async (run: (tx: typeof db) => unknown) => run(db)
}));
vi.mock('@metorial/audit-scope', () => ({
  createSystemAuditScope: (d: unknown) => ({ system: d })
}));
vi.mock('@metorial/cron', () => ({ createCron: (_: unknown, run: unknown) => run }));
vi.mock('@metorial/fabric', () => ({ Fabric: { fire } }));
vi.mock('@metorial/module-file', () => ({
  fileService: { requestContentHashes },
  hasValidContentHashes: (file: { contentSha256: string | null }) => !!file.contentSha256
}));
vi.mock('@metorial/module-flags', () => ({ flagService: { isFlagEnabledForInstance } }));
vi.mock('@metorial/queue', () => ({
  createQueue: () => ({ process: (run: unknown) => run, add, addManyWithOps }),
  hourlyPacedDelay: () => ({ delay: 1 })
}));
vi.mock('@metorial/skills-scm-utils', () => ({
  getOriginTenant: async () => ({ id: 'tenant_1' }),
  origin: { scmRepository: { getMany }, codeBucket: { delete: deleteCodeBucket } }
}));
vi.mock('../env', () => ({
  env: {
    skillSync: {
      SKILL_SYNC_MIGRATION_NON_GITHUB_MAX_FILES: 20_000,
      SKILL_SYNC_CODE_BUCKET_RETENTION: 14 * 24 * 3600
    }
  }
}));
vi.mock('../lib/destinationSync', () => ({ forceSkillDestinationSync }));
vi.mock('./sync/_lib/lock', () => ({
  withDestinationSyncLock: (run: (data: unknown) => unknown) => run
}));

import {
  deleteMigratedSkillDestinationCodeBucket,
  migrateSkillDestinationToManifest,
  skillDestinationMigrateStorageManyQueueProcessor
} from './storage';

let now = new Date('2026-11-08T12:00:00Z');
let day = 24 * 60 * 60 * 1000;

let destination = (overrides: Record<string, unknown> = {}) => ({
  oid: 5n,
  id: 'destination_1',
  storageMode: 'code_bucket',
  storageModeChangedAt: null,
  codeBucketId: 'bucket_1',
  skillMarketplace: {
    organizationOid: 100n,
    instanceOid: 200n,
    projectOid: 300n,
    repositories: [
      {
        skillRepository: {
          oid: 1n,
          repoId: 'origin_repo_1',
          deletionsAppliedAt: new Date(now.getTime() - 1000)
        }
      }
    ]
  },
  skillPlugin: null,
  ...overrides
});

let migrate = (requestedBy: 'cron' | 'ops' = 'cron') =>
  migrateSkillDestinationToManifest({ destinationId: 'destination_1', requestedBy });

beforeEach(() => {
  vi.resetAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(now);
  db.skillDestination.findUnique.mockResolvedValue(destination());
  db.skillDestination.update.mockResolvedValue({ ...destination(), storageMode: 'manifest' });
  db.skillDestinationSync.findFirst.mockImplementation(async (args: { where: object }) =>
    'status' in args.where ? null : { id: 'sync_latest', status: 'completed' }
  );
  db.skillDestinationDeletedFile.findFirst.mockResolvedValue({
    createdAt: new Date(now.getTime() - day)
  });
  db.skillDestinationFile.findMany.mockResolvedValue([
    { signature: 'file:11' },
    { signature: 'file:12' }
  ]);
  db.file.findMany.mockResolvedValue([
    { oid: 11n, id: 'file_11', contentSha256: 'a' },
    { oid: 12n, id: 'file_12', contentSha256: 'b' }
  ]);
  db.skillDestinationFile.count.mockResolvedValue(100);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('migration preconditions', () => {
  it('migrates a quiet destination: sets manifest mode, clears item hashes and forces a sync', async () => {
    expect(await migrate()).toEqual({ status: 'migrated' });

    expect(db.skillDestination.update).toHaveBeenCalledWith({
      where: { oid: 5n },
      data: { storageMode: 'manifest', storageModeChangedAt: now }
    });
    expect(db.skillDestination.update.mock.calls[0]![0].data).not.toHaveProperty(
      'codeBucketId'
    );
    expect(db.skillDestinationItem.updateMany).toHaveBeenCalledWith({
      where: { destinationOid: 5n },
      data: { hash: '' }
    });
    expect(forceSkillDestinationSync).toHaveBeenCalledWith({
      destination: expect.objectContaining({ oid: 5n }),
      trigger: 'migration'
    });
    let rowRewrites = db.$executeRaw.mock.calls.map(([sql]) => sql.join('?'));
    expect(rowRewrites).toEqual([
      expect.stringContaining('DELETE FROM "SkillDestinationFile"'),
      expect.stringContaining(`SET "path" = ltrim("path", '/')`)
    ]);
    expect(fire).toHaveBeenCalledWith(
      'skill.destination.audit.storage_migrated:after',
      expect.objectContaining({ requestedBy: 'cron' })
    );
  });

  it('blocks while a sync is active', async () => {
    db.skillDestinationSync.findFirst.mockResolvedValue({
      id: 'sync_active',
      status: 'processing'
    });

    expect(await migrate()).toEqual({ status: 'blocked', reason: 'sync_active' });
    expect(db.skillDestination.update).not.toHaveBeenCalled();
  });

  it('blocks when the latest sync did not complete', async () => {
    db.skillDestinationSync.findFirst.mockImplementation(async (args: { where: object }) =>
      'status' in args.where ? null : { id: 'sync_latest', status: 'failed' }
    );

    expect(await migrate()).toEqual({
      status: 'blocked',
      reason: 'latest_sync_not_completed'
    });
  });

  it('blocks while a repository still owes explicit deletes', async () => {
    db.skillDestinationDeletedFile.findFirst.mockResolvedValue({ createdAt: now });

    expect(await migrate()).toEqual({ status: 'blocked', reason: 'deletes_owed' });
    expect(db.skillDestination.update).not.toHaveBeenCalled();
  });

  it('blocks a repository that never applied deletes', async () => {
    db.skillDestination.findUnique.mockResolvedValue(
      destination({
        skillMarketplace: {
          ...destination().skillMarketplace,
          repositories: [{ skillRepository: { oid: 1n, deletionsAppliedAt: null } }]
        }
      })
    );

    expect(await migrate()).toEqual({ status: 'blocked', reason: 'deletes_owed' });
  });

  it('requests hashes for stragglers and waits for them', async () => {
    db.file.findMany.mockResolvedValue([
      { oid: 11n, id: 'file_11', contentSha256: 'a' },
      { oid: 12n, id: 'file_12', contentSha256: null }
    ]);

    expect(await migrate()).toEqual({ status: 'blocked', reason: 'file_hashes_missing' });
    expect(db.file.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { oid: { in: [11n, 12n] } } })
    );
    expect(requestContentHashes).toHaveBeenCalledOnce();
    expect(requestContentHashes).toHaveBeenCalledWith({
      file: expect.objectContaining({ id: 'file_12' })
    });
  });

  it('keeps large destinations linked to GitLab or Bitbucket on code-bucket storage', async () => {
    db.skillDestinationFile.count.mockResolvedValue(20_001);
    getMany.mockResolvedValue({ repositories: [{ provider: 'gitlab' }] });

    expect(await migrate()).toEqual({
      status: 'blocked',
      reason: 'too_many_files_for_provider'
    });
    expect(getMany).toHaveBeenCalledWith({
      tenantId: 'tenant_1',
      scmRepositoryIds: ['origin_repo_1']
    });
  });

  it('migrates large destinations that only push to GitHub', async () => {
    db.skillDestinationFile.count.mockResolvedValue(50_000);
    getMany.mockResolvedValue({ repositories: [{ provider: 'github' }] });

    expect(await migrate()).toEqual({ status: 'migrated' });
  });

  it('does not ask Origin for providers below the file threshold', async () => {
    getMany.mockResolvedValue({ repositories: [{ provider: 'bitbucket' }] });

    expect(await migrate()).toEqual({ status: 'migrated' });
    expect(getMany).not.toHaveBeenCalled();
  });

  it('leaves demoted destinations alone unless ops asks again', async () => {
    db.skillDestination.findUnique.mockResolvedValue(
      destination({ storageModeChangedAt: new Date(now.getTime() - day) })
    );

    expect(await migrate('cron')).toEqual({ status: 'blocked', reason: 'demoted' });
    expect(
      await migrateSkillDestinationToManifest({
        destinationId: 'destination_1',
        requestedBy: 'ops',
        skipDemoted: true
      })
    ).toEqual({ status: 'blocked', reason: 'demoted' });
    expect(await migrate('ops')).toEqual({ status: 'migrated' });
  });

  it('does nothing for a destination that already uses manifests', async () => {
    db.skillDestination.findUnique.mockResolvedValue(destination({ storageMode: 'manifest' }));

    expect(await migrate()).toEqual({ status: 'blocked', reason: 'not_code_bucket' });
    expect(forceSkillDestinationSync).not.toHaveBeenCalled();
  });
});

describe('migration fan-out', () => {
  let many = skillDestinationMigrateStorageManyQueueProcessor as unknown as (d: {
    cursor?: string;
    organizationOid?: string;
  }) => Promise<void>;

  it('only enqueues destinations whose instance has the flag, checking each instance once', async () => {
    db.skillDestination.findMany.mockResolvedValue([
      { id: 'd1', skillMarketplace: { instanceOid: 1n }, skillPlugin: null },
      { id: 'd2', skillMarketplace: null, skillPlugin: { instanceOid: 1n } },
      { id: 'd3', skillMarketplace: { instanceOid: 2n }, skillPlugin: null }
    ]);
    isFlagEnabledForInstance.mockImplementation(async ({ instance }) => instance.oid === 1n);

    await many({});

    expect(db.skillDestination.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { storageMode: 'code_bucket', storageModeChangedAt: null, id: undefined }
      })
    );
    expect(isFlagEnabledForInstance).toHaveBeenCalledTimes(2);
    expect(addManyWithOps).toHaveBeenCalledWith([
      { data: { destinationId: 'd1', requestedBy: 'cron' }, opts: { id: 'migrate:d1' } },
      { data: { destinationId: 'd2', requestedBy: 'cron' }, opts: { id: 'migrate:d2' } }
    ]);
  });

  it('enqueues every destination of an organization when ops triggers it', async () => {
    db.skillDestination.findMany.mockResolvedValue([
      { id: 'd1', skillMarketplace: { instanceOid: 1n }, skillPlugin: null }
    ]);

    await many({ organizationOid: '100' });

    expect(db.skillDestination.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          storageMode: 'code_bucket',
          storageModeChangedAt: null
        })
      })
    );
    expect(isFlagEnabledForInstance).not.toHaveBeenCalled();
    expect(addManyWithOps).toHaveBeenCalledWith([
      {
        data: { destinationId: 'd1', requestedBy: 'ops', skipDemoted: true },
        opts: { id: 'migrate:d1' }
      }
    ]);
  });
});

describe('code bucket deletion', () => {
  let migrated = (overrides: Record<string, unknown> = {}) =>
    destination({
      storageMode: 'manifest',
      storageModeChangedAt: new Date(now.getTime() - 20 * day),
      ...overrides
    });

  beforeEach(() => {
    db.skillDestination.findUnique.mockResolvedValue(migrated());
    db.skillDestinationSync.findFirst.mockResolvedValue({ oid: 40n });
    db.skillDestinationSyncRepositoryPropagation.findFirst.mockResolvedValue({ oid: 41n });
    db.skillDestination.updateMany.mockResolvedValue({ count: 1 });
    deleteCodeBucket.mockResolvedValue({ id: 'bucket_1', deletedAt: now });
  });

  it('empties and forgets the code bucket 14 days after every repository synced from a manifest', async () => {
    expect(
      await deleteMigratedSkillDestinationCodeBucket({ destinationId: 'destination_1' })
    ).toBe(true);

    let completedSince = {
      gte: new Date(now.getTime() - 20 * day),
      lte: new Date(now.getTime() - 14 * day)
    };
    expect(db.skillDestinationSyncRepositoryPropagation.findFirst).toHaveBeenCalledWith({
      where: {
        skillRepositoryOid: 1n,
        skillDestinationSync: { destinationOid: 5n },
        manifestOid: { not: null },
        status: 'completed',
        completedAt: completedSince
      },
      select: { oid: true }
    });
    expect(deleteCodeBucket).toHaveBeenCalledExactlyOnceWith({
      tenantId: 'tenant_1',
      codeBucketId: 'bucket_1'
    });
    expect(db.skillDestination.updateMany).toHaveBeenCalledWith({
      where: { oid: 5n, storageMode: 'manifest', codeBucketId: 'bucket_1' },
      data: { codeBucketId: null }
    });
  });

  it('keeps the bucket until every repository has a completed manifest sync', async () => {
    db.skillDestinationSyncRepositoryPropagation.findFirst.mockResolvedValue(null);

    expect(
      await deleteMigratedSkillDestinationCodeBucket({ destinationId: 'destination_1' })
    ).toBe(false);
    expect(deleteCodeBucket).not.toHaveBeenCalled();
  });

  it('forgets a bucket Origin no longer has', async () => {
    deleteCodeBucket.mockRejectedValue({ data: { status: 404 } });

    expect(
      await deleteMigratedSkillDestinationCodeBucket({ destinationId: 'destination_1' })
    ).toBe(true);
    expect(db.skillDestination.updateMany).toHaveBeenCalledOnce();
  });

  it('keeps the bucket without failing the job while an Origin sync still exports it', async () => {
    let info = vi.spyOn(console, 'info').mockImplementation(() => {});
    let error = vi.spyOn(console, 'error').mockImplementation(() => {});
    deleteCodeBucket.mockRejectedValue({ data: { status: 409, code: 'code_bucket_in_use' } });

    expect(
      await deleteMigratedSkillDestinationCodeBucket({ destinationId: 'destination_1' })
    ).toBe(false);
    expect(db.skillDestination.updateMany).not.toHaveBeenCalled();
    expect(JSON.parse(info.mock.calls[0]![0])).toMatchObject({
      event: 'cargo_skill_destination_code_bucket_in_use',
      level: 'info',
      codeBucketId: 'bucket_1'
    });
    expect(error).not.toHaveBeenCalled();

    info.mockRestore();
    error.mockRestore();
  });

  it('keeps the bucket reference when Origin fails so the next run retries', async () => {
    deleteCodeBucket.mockRejectedValue({ data: { status: 503 } });

    await expect(
      deleteMigratedSkillDestinationCodeBucket({ destinationId: 'destination_1' })
    ).rejects.toEqual({ data: { status: 503 } });
    expect(db.skillDestination.updateMany).not.toHaveBeenCalled();
  });

  it('keeps the bucket for a destination that was demoted back', async () => {
    db.skillDestination.findUnique.mockResolvedValue(migrated({ storageMode: 'code_bucket' }));

    expect(
      await deleteMigratedSkillDestinationCodeBucket({ destinationId: 'destination_1' })
    ).toBe(false);
    expect(deleteCodeBucket).not.toHaveBeenCalled();
  });
});
