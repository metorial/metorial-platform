import { createSystemAuditScope } from '@metorial/audit-scope';
import { createCron } from '@metorial/cron';
import { db, withTransaction } from '@metorial/db';
import { Fabric } from '@metorial/fabric';
import { fileService, hasValidContentHashes } from '@metorial/module-file';
import { flagService } from '@metorial/module-flags';
import { createQueue, hourlyPacedDelay } from '@metorial/queue';
import { getOriginTenant, origin } from '@metorial/skills-scm-utils';
import { env } from '../env';
import { forceSkillDestinationSync } from '../lib/destinationSync';
import {
  activeSkillDestinationOwnerWhere,
  hasActiveSkillDestinationOwner
} from './sync/_lib/eligibility';
import { withDestinationSyncLock } from './sync/_lib/lock';
import { convertSkillDestinationRowsToManifestPaths } from './sync/_lib/rowPaths';

let pageSize = 500;
let fileLookupChunkSize = 1_000;

let migrateStorageJob = 'cargo/skill/destination/migrate-storage';

let activeSyncStatuses = ['pending', 'processing', 'waiting_for_review'] as const;

export type SkillDestinationMigrationBlocker =
  | 'not_code_bucket'
  | 'inactive_owner'
  | 'demoted'
  | 'sync_active'
  | 'latest_sync_not_completed'
  | 'deletes_owed'
  | 'file_hashes_missing'
  | 'too_many_files_for_provider';

export type SkillDestinationMigrationResult =
  { status: 'migrated' } | { status: 'blocked'; reason: SkillDestinationMigrationBlocker };

let destinationOwnerInclude = {
  skillMarketplace: {
    include: { repositories: { include: { skillRepository: true } } }
  },
  skillPlugin: {
    include: { repositories: { include: { skillRepository: true } } }
  }
} as const;

let loadDestination = async (destinationId: string) =>
  await db.skillDestination.findUnique({
    where: { id: destinationId },
    include: destinationOwnerInclude
  });

type LoadedDestination = NonNullable<Awaited<ReturnType<typeof loadDestination>>>;

let getOwner = (destination: LoadedDestination) =>
  destination.skillMarketplace ?? destination.skillPlugin;

let getLinkedRepositories = (destination: LoadedDestination) =>
  (getOwner(destination)?.repositories ?? []).map(link => link.skillRepository);

let requestMissingFileHashes = async (destination: LoadedDestination) => {
  let rows = await db.skillDestinationFile.findMany({
    where: { destinationOid: destination.oid, signature: { startsWith: 'file:' } },
    select: { signature: true }
  });
  let fileOids = [...new Set(rows.map(row => BigInt(row.signature.slice('file:'.length))))];

  let missing = 0;
  for (let i = 0; i < fileOids.length; i += fileLookupChunkSize) {
    let files = await db.file.findMany({
      where: { oid: { in: fileOids.slice(i, i + fileLookupChunkSize) } },
      select: {
        oid: true,
        id: true,
        storeId: true,
        fileSize: true,
        contentSha256: true,
        contentSha256StoreId: true,
        contentGitBlobSha: true,
        contentCrc32: true
      }
    });

    for (let file of files) {
      if (hasValidContentHashes(file)) continue;
      missing++;
      await fileService.requestContentHashes({ file });
    }
  }

  return missing;
};

let hasTooManyFilesForProvider = async (destination: LoadedDestination) => {
  let repositories = getLinkedRepositories(destination);
  let owner = getOwner(destination);
  if (!repositories.length || !owner) return false;

  let fileCount = await db.skillDestinationFile.count({
    where: { destinationOid: destination.oid }
  });
  if (fileCount <= env.skillSync.SKILL_SYNC_MIGRATION_NON_GITHUB_MAX_FILES) return false;

  let tenant = await getOriginTenant({ oid: owner.projectOid });
  let { repositories: originRepositories } = await origin.scmRepository.getMany({
    tenantId: tenant.id,
    scmRepositoryIds: repositories.map(repository => repository.repoId)
  });

  return originRepositories.some(repository => repository.provider !== 'github');
};

export let getSkillDestinationMigrationBlocker = async (
  destination: LoadedDestination
): Promise<SkillDestinationMigrationBlocker | null> => {
  if (destination.storageMode !== 'code_bucket') return 'not_code_bucket';
  if (!hasActiveSkillDestinationOwner(destination)) return 'inactive_owner';

  let activeSync = await db.skillDestinationSync.findFirst({
    where: { destinationOid: destination.oid, status: { in: [...activeSyncStatuses] } },
    select: { oid: true }
  });
  if (activeSync) return 'sync_active';

  let latestSync = await db.skillDestinationSync.findFirst({
    where: { destinationOid: destination.oid },
    orderBy: { oid: 'desc' },
    select: { status: true }
  });
  if (latestSync && latestSync.status !== 'completed') return 'latest_sync_not_completed';

  let newestDeletedFile = await db.skillDestinationDeletedFile.findFirst({
    where: { destinationOid: destination.oid },
    orderBy: { createdAt: 'desc' },
    select: { createdAt: true }
  });
  if (
    newestDeletedFile &&
    getLinkedRepositories(destination).some(
      repository =>
        !repository.deletionsAppliedAt ||
        repository.deletionsAppliedAt < newestDeletedFile.createdAt
    )
  ) {
    return 'deletes_owed';
  }

  if ((await requestMissingFileHashes(destination)) > 0) return 'file_hashes_missing';

  if (await hasTooManyFilesForProvider(destination)) return 'too_many_files_for_provider';

  return null;
};

export let migrateSkillDestinationToManifest = async (d: {
  destinationId: string;
  requestedBy: 'cron' | 'ops';
  skipDemoted?: boolean;
}): Promise<SkillDestinationMigrationResult> => {
  let destination = await loadDestination(d.destinationId);
  if (!destination || destination.storageMode !== 'code_bucket') {
    return { status: 'blocked', reason: 'not_code_bucket' };
  }
  if ((d.requestedBy === 'cron' || d.skipDemoted) && destination.storageModeChangedAt) {
    return { status: 'blocked', reason: 'demoted' };
  }

  let migrate = async (): Promise<SkillDestinationMigrationResult> => {
    let current = await loadDestination(d.destinationId);
    if (!current) return { status: 'blocked', reason: 'not_code_bucket' };

    let blocker = await getSkillDestinationMigrationBlocker(current);
    if (blocker) {
      console.info(
        JSON.stringify({
          event: 'cargo_skill_destination_migration_blocked',
          level: 'info',
          skillDestinationId: current.id,
          reason: blocker
        })
      );
      return { status: 'blocked', reason: blocker };
    }

    let owner = getOwner(current);
    let migrated = await withTransaction(async db => {
      let [migrated] = await db.skillDestination.updateManyAndReturn({
        where: { oid: current.oid, ...activeSkillDestinationOwnerWhere },
        data: { storageMode: 'manifest', storageModeChangedAt: new Date() }
      });
      if (!migrated) return null;

      await db.skillDestinationItem.updateMany({
        where: { destinationOid: current.oid },
        data: { hash: '' }
      });
      await convertSkillDestinationRowsToManifestPaths(current.oid);
      await forceSkillDestinationSync({ destination: current, trigger: 'migration' });

      return migrated;
    });
    if (!migrated) return { status: 'blocked', reason: 'inactive_owner' };

    if (owner) {
      await Fabric.fire('skill.destination.audit.storage_migrated:after', {
        auditScope: createSystemAuditScope({
          organization: { oid: owner.organizationOid },
          instance: { oid: owner.instanceOid },
          job: migrateStorageJob,
          metadata: { requestedBy: d.requestedBy }
        }),
        skillDestination: migrated,
        requestedBy: d.requestedBy
      });
    }

    return { status: 'migrated' };
  };

  let latestSync = await db.skillDestinationSync.findFirst({
    where: { destinationOid: destination.oid },
    orderBy: { oid: 'desc' },
    select: { id: true }
  });
  if (!latestSync) return await migrate();

  let result: SkillDestinationMigrationResult = {
    status: 'blocked',
    reason: 'sync_active'
  };
  await withDestinationSyncLock(async () => {
    result = await migrate();
  })({ skillDestinationSyncId: latestSync.id });

  return result;
};

export let skillDestinationMigrateStorageCron = createCron(
  { name: `${migrateStorageJob}/cron`, cron: '*/15 * * * *' },
  async () => {
    if (!env.skillSync.SKILL_SYNC_RECONCILER_CRONS_ENABLED) return;
    await skillDestinationMigrateStorageManyQueue.add({});
  }
);

export let skillDestinationMigrateStorageManyQueue = createQueue<{
  cursor?: string;
  organizationOid?: string;
}>({
  name: `${migrateStorageJob}/many`,
  workerOpts: { concurrency: 1 }
});

export let skillDestinationMigrateStorageManyQueueProcessor =
  skillDestinationMigrateStorageManyQueue.process(async data => {
    let organizationOid = data.organizationOid ? BigInt(data.organizationOid) : undefined;
    let destinations = await db.skillDestination.findMany({
      where: {
        storageMode: 'code_bucket',
        storageModeChangedAt: null,
        id: data.cursor ? { gt: data.cursor } : undefined,
        OR: [
          { skillMarketplace: { status: 'active', organizationOid } },
          { skillPlugin: { status: 'active', organizationOid } }
        ]
      },
      orderBy: { id: 'asc' },
      take: pageSize,
      select: {
        id: true,
        skillMarketplace: { select: { instanceOid: true } },
        skillPlugin: { select: { instanceOid: true } }
      }
    });
    if (!destinations.length) return;

    let flagByInstance = new Map<bigint, Promise<boolean>>();
    let isEnabled = (instanceOid: bigint) => {
      let cached = flagByInstance.get(instanceOid);
      if (!cached) {
        cached = flagService.isFlagEnabledForInstance({
          instance: { oid: instanceOid },
          flag: 'skills-manifest-sync'
        });
        flagByInstance.set(instanceOid, cached);
      }
      return cached;
    };

    let eligible: string[] = [];
    for (let destination of destinations) {
      let instanceOid =
        destination.skillMarketplace?.instanceOid ?? destination.skillPlugin?.instanceOid;
      if (!instanceOid) continue;
      if (organizationOid || (await isEnabled(instanceOid))) eligible.push(destination.id);
    }

    await skillDestinationMigrateStorageSingleQueue.addManyWithOps(
      eligible.map(destinationId => ({
        data: organizationOid
          ? { destinationId, requestedBy: 'ops' as const, skipDemoted: true }
          : { destinationId, requestedBy: 'cron' as const },
        opts: { id: `migrate:${destinationId}` }
      }))
    );

    if (destinations.length === pageSize) {
      await skillDestinationMigrateStorageManyQueue.add(
        {
          cursor: destinations[destinations.length - 1]!.id,
          organizationOid: data.organizationOid
        },
        hourlyPacedDelay()
      );
    }
  });

export let skillDestinationMigrateStorageSingleQueue = createQueue<{
  destinationId: string;
  requestedBy: 'cron' | 'ops';
  skipDemoted?: boolean;
}>({
  name: `${migrateStorageJob}/single`,
  workerOpts: { concurrency: 5, limiter: { max: 10, duration: 1000 } }
});

export let skillDestinationMigrateStorageSingleQueueProcessor =
  skillDestinationMigrateStorageSingleQueue.process(async data => {
    await migrateSkillDestinationToManifest(data);
  });

export let deleteMigratedSkillDestinationCodeBucket = async (d: { destinationId: string }) => {
  let destination = await loadDestination(d.destinationId);
  if (!destination?.codeBucketId || destination.storageMode !== 'manifest') return false;
  if (!destination.storageModeChangedAt) return false;

  let retentionStartedBefore = new Date(
    Date.now() - env.skillSync.SKILL_SYNC_CODE_BUCKET_RETENTION * 1000
  );
  let completedSince = { gte: destination.storageModeChangedAt, lte: retentionStartedBefore };
  let completedManifestSync = await db.skillDestinationSync.findFirst({
    where: {
      destinationOid: destination.oid,
      storageMode: 'manifest',
      status: 'completed',
      completedAt: completedSince
    },
    select: { oid: true }
  });
  if (!completedManifestSync) return false;

  for (let repository of getLinkedRepositories(destination)) {
    let completedPropagation = await db.skillDestinationSyncRepositoryPropagation.findFirst({
      where: {
        skillRepositoryOid: repository.oid,
        skillDestinationSync: { destinationOid: destination.oid },
        manifestOid: { not: null },
        status: 'completed',
        completedAt: completedSince
      },
      select: { oid: true }
    });
    if (!completedPropagation) return false;
  }

  let owner = getOwner(destination);
  if (owner) {
    let tenant = await getOriginTenant({ oid: owner.projectOid });
    let deleted = await origin.codeBucket
      .delete({ tenantId: tenant.id, codeBucketId: destination.codeBucketId })
      .then(() => true)
      .catch(error => {
        if (error?.data?.status === 404) return true;
        if (error?.data?.code === 'code_bucket_in_use') return false;
        throw error;
      });
    if (!deleted) {
      console.info(
        JSON.stringify({
          event: 'cargo_skill_destination_code_bucket_in_use',
          level: 'info',
          skillDestinationId: destination.id,
          codeBucketId: destination.codeBucketId
        })
      );
      return false;
    }
  }

  let updated = await db.skillDestination.updateMany({
    where: {
      oid: destination.oid,
      storageMode: 'manifest',
      codeBucketId: destination.codeBucketId
    },
    data: { codeBucketId: null }
  });
  return updated.count > 0;
};

export let skillDestinationDeleteCodeBucketCron = createCron(
  { name: 'cargo/skill/destination/delete-code-bucket/cron', cron: '30 3 * * *' },
  async () => {
    if (!env.skillSync.SKILL_SYNC_RECONCILER_CRONS_ENABLED) return;
    await skillDestinationDeleteCodeBucketManyQueue.add({});
  }
);

export let skillDestinationDeleteCodeBucketManyQueue = createQueue<{ cursor?: string }>({
  name: 'cargo/skill/destination/delete-code-bucket/many',
  workerOpts: { concurrency: 1 }
});

export let skillDestinationDeleteCodeBucketManyQueueProcessor =
  skillDestinationDeleteCodeBucketManyQueue.process(async data => {
    let destinations = await db.skillDestination.findMany({
      where: {
        storageMode: 'manifest',
        codeBucketId: { not: null },
        storageModeChangedAt: {
          lte: new Date(Date.now() - env.skillSync.SKILL_SYNC_CODE_BUCKET_RETENTION * 1000)
        },
        id: data.cursor ? { gt: data.cursor } : undefined
      },
      orderBy: { id: 'asc' },
      take: pageSize,
      select: { id: true }
    });
    if (!destinations.length) return;

    await skillDestinationDeleteCodeBucketSingleQueue.addManyWithOps(
      destinations.map(destination => ({
        data: { destinationId: destination.id },
        opts: { id: `delete-code-bucket:${destination.id}` }
      }))
    );

    if (destinations.length === pageSize) {
      await skillDestinationDeleteCodeBucketManyQueue.add(
        { cursor: destinations[destinations.length - 1]!.id },
        hourlyPacedDelay()
      );
    }
  });

export let skillDestinationDeleteCodeBucketSingleQueue = createQueue<{
  destinationId: string;
}>({
  name: 'cargo/skill/destination/delete-code-bucket/single',
  workerOpts: { concurrency: 5, limiter: { max: 10, duration: 1000 } }
});

export let skillDestinationDeleteCodeBucketSingleQueueProcessor =
  skillDestinationDeleteCodeBucketSingleQueue.process(async data => {
    await deleteMigratedSkillDestinationCodeBucket(data);
  });
