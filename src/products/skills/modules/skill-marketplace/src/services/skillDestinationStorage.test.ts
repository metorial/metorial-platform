import { ServiceError } from '@lowerdeck/error';
import { beforeEach, describe, expect, it, vi } from 'vitest';

let { db, fire, forceSkillDestinationSync, createCodeBucket, addSingle, addMany } = vi.hoisted(
  () => ({
    db: {
      skillDestination: { findUnique: vi.fn(), update: vi.fn() },
      skillDestinationSync: { findFirst: vi.fn() },
      skillDestinationItem: { updateMany: vi.fn() },
      skillDestinationFile: { updateMany: vi.fn() },
      skillRepository: { updateMany: vi.fn() },
      organization: { findUnique: vi.fn() },
      $executeRaw: vi.fn()
    },
    fire: vi.fn(),
    forceSkillDestinationSync: vi.fn(),
    createCodeBucket: vi.fn(),
    addSingle: vi.fn(),
    addMany: vi.fn()
  })
);

vi.mock('@metorial/db', () => ({
  db,
  withTransaction: async (run: (tx: typeof db) => unknown) => run(db)
}));
vi.mock('@metorial/audit-scope', () => ({
  createSystemAuditScope: (d: unknown) => ({ system: d })
}));
vi.mock('@metorial/fabric', () => ({ Fabric: { fire } }));
vi.mock('@metorial/skills-scm-utils', () => ({
  getOriginTenant: async () => ({ id: 'tenant_1' }),
  origin: { codeBucket: { create: createCodeBucket } }
}));
vi.mock('../lib/destinationSync', () => ({ forceSkillDestinationSync }));
vi.mock('../queues/storage', () => ({
  skillDestinationMigrateStorageSingleQueue: { add: addSingle },
  skillDestinationMigrateStorageManyQueue: { add: addMany }
}));
vi.mock('../queues/sync/_lib/lock', () => ({
  withDestinationSyncLock: (run: (data: unknown) => unknown) => run
}));

import { skillDestinationStorageService } from './skillDestinationStorage';

let destination = (overrides: Record<string, unknown> = {}) => ({
  oid: 5n,
  id: 'destination_1',
  storageMode: 'manifest',
  codeBucketId: 'bucket_old',
  skillMarketplace: { organizationOid: 100n, instanceOid: 200n, projectOid: 300n },
  skillPlugin: null,
  ...overrides
});

beforeEach(() => {
  vi.resetAllMocks();
  db.skillDestination.findUnique.mockResolvedValue(destination());
  db.skillDestinationSync.findFirst.mockImplementation(async (args: { where: object }) =>
    'status' in args.where ? null : { id: 'sync_latest' }
  );
  createCodeBucket.mockResolvedValue({ id: 'bucket_new' });
  db.skillDestination.update.mockImplementation(async ({ data }) => ({
    ...destination(),
    ...data
  }));
});

describe('demotion to code-bucket storage', () => {
  it('creates a fresh code bucket, resets rows to bucket form and runs a full legacy sync', async () => {
    let demoted = await skillDestinationStorageService.demoteSkillDestinationToCodeBucket({
      skillDestinationId: 'destination_1'
    });

    expect(createCodeBucket).toHaveBeenCalledWith({
      tenantId: 'tenant_1',
      purpose: 'cargo.skill.destination',
      isReadOnly: false
    });
    expect(db.skillDestination.update).toHaveBeenCalledWith({
      where: { oid: 5n },
      data: {
        storageMode: 'code_bucket',
        storageModeChangedAt: expect.any(Date),
        codeBucketId: 'bucket_new',
        currentManifestOid: null
      }
    });
    expect(db.skillDestinationItem.updateMany).toHaveBeenCalledWith({
      where: { destinationOid: 5n },
      data: { hash: '' }
    });
    let rowRewrites = db.$executeRaw.mock.calls.map(([sql]) => sql.join('?'));
    expect(rowRewrites).toEqual([
      expect.stringContaining('DELETE FROM "SkillDestinationFile"'),
      expect.stringContaining(`SET "path" = '/' || "path"`)
    ]);
    expect(db.skillDestinationFile.updateMany).toHaveBeenCalledWith({
      where: { destinationOid: 5n },
      data: expect.objectContaining({ signature: '', gitBlobSha: null, sourceKey: null })
    });
    expect(db.skillRepository.updateMany).toHaveBeenCalledWith({
      where: {
        OR: [
          { marketplaceRepository: { skillMarketplace: { destinationOid: 5n } } },
          { pluginRepository: { skillPlugin: { destinationOid: 5n } } }
        ]
      },
      data: expect.objectContaining({
        lastPropagatedManifestOid: null,
        dismissedManifestSha256: null,
        nextRepairAt: null
      })
    });
    expect(forceSkillDestinationSync).toHaveBeenCalledWith({
      destination: expect.objectContaining({ storageMode: 'code_bucket' }),
      trigger: 'migration'
    });
    expect(fire).toHaveBeenCalledWith('skill.destination.audit.storage_demoted:after', {
      auditScope: expect.anything(),
      skillDestination: demoted,
      previousCodeBucketId: 'bucket_old'
    });
  });

  it('gives a demoted managed plugin a managed-plugin code bucket', async () => {
    db.skillDestination.findUnique.mockResolvedValue(
      destination({
        skillMarketplace: null,
        skillPlugin: {
          organizationOid: 100n,
          instanceOid: 200n,
          projectOid: 300n,
          isManaged: true
        }
      })
    );

    await skillDestinationStorageService.demoteSkillDestinationToCodeBucket({
      skillDestinationId: 'destination_1'
    });

    expect(createCodeBucket).toHaveBeenCalledWith(
      expect.objectContaining({ purpose: 'cargo.skill.managed-plugin' })
    );
  });

  it('refuses to demote while a sync is running', async () => {
    db.skillDestinationSync.findFirst.mockResolvedValue({ id: 'sync_running' });

    await expect(
      skillDestinationStorageService.demoteSkillDestinationToCodeBucket({
        skillDestinationId: 'destination_1'
      })
    ).rejects.toBeInstanceOf(ServiceError);
    expect(createCodeBucket).not.toHaveBeenCalled();
  });

  it('refuses to demote a destination that already uses a code bucket', async () => {
    db.skillDestination.findUnique.mockResolvedValue(
      destination({ storageMode: 'code_bucket' })
    );

    await expect(
      skillDestinationStorageService.demoteSkillDestinationToCodeBucket({
        skillDestinationId: 'destination_1'
      })
    ).rejects.toBeInstanceOf(ServiceError);
  });
});

describe('ops migration trigger', () => {
  it('enqueues the single migration job for one destination right away', async () => {
    db.skillDestination.findUnique.mockResolvedValue({ id: 'destination_1' });

    await skillDestinationStorageService.migrateSkillDestinationStorage({
      skillDestinationId: 'destination_1'
    });

    expect(addSingle).toHaveBeenCalledWith(
      { destinationId: 'destination_1', requestedBy: 'ops' },
      { id: expect.stringMatching(/^migrate:ops:destination_1:/) }
    );
  });

  it('fans out over an organization', async () => {
    db.organization.findUnique.mockResolvedValue({ oid: 100n });

    await skillDestinationStorageService.migrateSkillDestinationStorage({
      organizationId: 'org_1'
    });

    expect(addMany).toHaveBeenCalledWith({ organizationOid: '100' });
  });
});
