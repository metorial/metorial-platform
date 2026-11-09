import { createCron } from '@metorial/cron';
import { db } from '@metorial/db';
import { createQueue, hourlyPacedDelay } from '@metorial/queue';
import { getOriginTenant, origin } from '@metorial/skills-scm-utils';
import { env } from '../../env';
import { isRetryableManifestErrorCode, type ManifestOriginSync } from './manifest/originSync';
import { getRepairDelayMs, handleSourceRecoveryLimitReached } from './manifest/propagate';
import {
  getSourceRecoveryKeys,
  isSourceRecoveryErrorCode,
  recoverMissingManifestSources
} from './manifest/recovery';
import {
  getLatestRepositoryPropagation,
  hasActiveContentSync,
  skillRepositoryDestinationInclude,
  startRepositoryPropagationSync
} from './manifest/repositorySync';

let pageSize = 500;

let activePropagationStatuses = ['pending', 'processing', 'waiting_for_review'];

let getMissingSourceKeys = async (d: { projectOid: bigint; originSyncId: string | null }) => {
  if (!d.originSyncId) return undefined;

  let tenant = await getOriginTenant({ oid: d.projectOid });
  let { syncs } = await origin.scmRepositorySync.getMany({
    tenantId: tenant.id,
    scmRepositorySyncIds: [d.originSyncId]
  });
  return getSourceRecoveryKeys((syncs[0] as ManifestOriginSync | undefined)?.errorDetails);
};

let getLinkedDestination = (repository: {
  marketplaceRepository: { skillMarketplace: { destination: unknown } } | null;
  pluginRepository: { skillPlugin: { destination: unknown } } | null;
}) =>
  (repository.marketplaceRepository?.skillMarketplace.destination ??
    repository.pluginRepository?.skillPlugin.destination ??
    null) as {
    oid: bigint;
    storageMode: 'code_bucket' | 'manifest';
    currentManifestOid: bigint | null;
    currentManifest: { sha256: string } | null;
  } | null;

export let skillSyncRepairCron = createCron(
  { name: 'cargo/skill/sync/repair/cron', cron: '*/15 * * * *' },
  async () => {
    if (!env.skillSync.SKILL_SYNC_RECONCILER_CRONS_ENABLED) return;
    await skillSyncRepairManyQueue.add({});
  }
);

export let skillSyncRepairManyQueue = createQueue<{ cursor?: string }>({
  name: 'cargo/skill/sync/repair/many',
  workerOpts: { concurrency: 1 }
});

export let skillSyncRepairManyQueueProcessor = skillSyncRepairManyQueue.process(async data => {
  let repositories = await db.skillRepository.findMany({
    where: {
      nextRepairAt: { lte: new Date() },
      id: data.cursor ? { gt: data.cursor } : undefined
    },
    orderBy: { id: 'asc' },
    take: pageSize,
    select: { id: true }
  });
  if (!repositories.length) return;

  await skillSyncRepairSingleQueue.addManyWithOps(
    repositories.map(repository => ({
      data: { skillRepositoryId: repository.id },
      opts: { id: `repair:${repository.id}` }
    }))
  );

  if (repositories.length === pageSize) {
    await skillSyncRepairManyQueue.add(
      { cursor: repositories[repositories.length - 1]!.id },
      hourlyPacedDelay()
    );
  }
});

export let skillSyncRepairSingleQueue = createQueue<{ skillRepositoryId: string }>({
  name: 'cargo/skill/sync/repair/single',
  workerOpts: { concurrency: 5, limiter: { max: 10, duration: 1000 } }
});

export let repairSkillRepository = async (data: { skillRepositoryId: string }) => {
  let now = new Date();
  let repository = await db.skillRepository.findUnique({
    where: { id: data.skillRepositoryId },
    include: skillRepositoryDestinationInclude
  });
  if (!repository?.nextRepairAt || repository.nextRepairAt > now) return;

  let stopRepairing = async (resetAttempts = false) => {
    await db.skillRepository.update({
      where: { oid: repository.oid },
      data: { nextRepairAt: null, ...(resetAttempts ? { repairAttempts: 0 } : {}) }
    });
  };

  let destination = getLinkedDestination(repository);
  if (!destination || destination.storageMode !== 'manifest' || !destination.currentManifest) {
    return await stopRepairing();
  }
  if (repository.lastPropagatedManifestOid === destination.currentManifestOid) {
    return await stopRepairing(true);
  }
  if (repository.dismissedManifestSha256 === destination.currentManifest.sha256) {
    return await stopRepairing();
  }

  let latest = await getLatestRepositoryPropagation(repository.oid);
  if (latest && activePropagationStatuses.includes(latest.status)) return;
  if (
    !latest ||
    latest.status !== 'failed' ||
    !isRetryableManifestErrorCode(latest.errorCode)
  ) {
    return await stopRepairing();
  }

  if (!env.skillSync.SKILL_SYNC_MANIFEST_PROPAGATION_ENABLED) return;
  if (await hasActiveContentSync(destination.oid)) return;

  let lastCompleted = await db.skillDestinationSyncRepositoryPropagation.findFirst({
    where: { skillRepositoryOid: repository.oid, status: 'completed' },
    orderBy: { oid: 'desc' },
    select: { oid: true }
  });
  let firstFailure = await db.skillDestinationSyncRepositoryPropagation.findFirst({
    where: {
      skillRepositoryOid: repository.oid,
      status: 'failed',
      oid: lastCompleted ? { gt: lastCompleted.oid } : undefined
    },
    orderBy: { oid: 'asc' },
    select: { completedAt: true, createdAt: true }
  });
  let failingSince = firstFailure?.completedAt ?? firstFailure?.createdAt;
  if (
    failingSince &&
    now.getTime() - failingSince.getTime() > env.skillSync.SKILL_SYNC_REPAIR_ALERT_AFTER * 1000
  ) {
    console.error(
      JSON.stringify({
        event: 'cargo_skill_repository_repair_failing',
        level: 'error',
        skillRepositoryId: repository.id,
        repoId: repository.repoId,
        errorCode: latest.errorCode,
        repairAttempts: repository.repairAttempts,
        failingSince: failingSince.toISOString()
      })
    );
  }

  if (isSourceRecoveryErrorCode(latest.errorCode)) {
    let latestSync = await db.skillDestinationSync.findUniqueOrThrow({
      where: { oid: latest.skillDestinationSyncOid },
      select: { id: true, oid: true, destinationOid: true }
    });
    let keys = await getMissingSourceKeys({
      projectOid: repository.projectOid,
      originSyncId: latest.originSyncId
    });
    let recovery = await recoverMissingManifestSources({
      destinationOid: latestSync.destinationOid,
      afterSyncOid: latestSync.oid,
      keys
    });
    let exhausted =
      recovery.status === 'limit_reached' &&
      (await handleSourceRecoveryLimitReached({
        skillDestinationSyncId: latestSync.id,
        propagation: latest,
        skillRepositoryOid: repository.oid,
        keys
      }));

    await db.skillRepository.update({
      where: { oid: repository.oid },
      data: {
        repairAttempts: { increment: 1 },
        nextRepairAt:
          recovery.status === 'limit_reached' && !exhausted
            ? new Date(now.getTime() + getRepairDelayMs(repository.repairAttempts + 1))
            : null
      }
    });
    return;
  }

  let started = await startRepositoryPropagationSync({
    destinationOid: destination.oid,
    skillRepositoryOid: repository.oid,
    trigger: 'repair'
  });
  await db.skillRepository.update({
    where: { oid: repository.oid },
    data: started
      ? { repairAttempts: { increment: 1 }, nextRepairAt: null }
      : { nextRepairAt: null }
  });
};

export let skillSyncRepairSingleQueueProcessor =
  skillSyncRepairSingleQueue.process(repairSkillRepository);

export let skillSyncDriftCheckCron = createCron(
  { name: 'cargo/skill/sync/drift-check/cron', cron: '0 * * * *' },
  async () => {
    if (!env.skillSync.SKILL_SYNC_RECONCILER_CRONS_ENABLED) return;
    await skillSyncDriftCheckManyQueue.add({});
  }
);

export let skillSyncDriftCheckManyQueue = createQueue<{ cursor?: string }>({
  name: 'cargo/skill/sync/drift-check/many',
  workerOpts: { concurrency: 1 }
});

export let skillSyncDriftCheckManyQueueProcessor = skillSyncDriftCheckManyQueue.process(
  async data => {
    if (!env.skillSync.SKILL_SYNC_MANIFEST_PROPAGATION_ENABLED) return;

    let repositories = await db.skillRepository.findMany({
      where: {
        lastPropagatedManifestOid: { not: null },
        lastDriftCheckAt: {
          lt: new Date(Date.now() - env.skillSync.SKILL_SYNC_DRIFT_CHECK_INTERVAL * 1000)
        },
        id: data.cursor ? { gt: data.cursor } : undefined
      },
      orderBy: { id: 'asc' },
      take: pageSize,
      select: { id: true }
    });
    if (!repositories.length) return;

    await skillSyncDriftCheckSingleQueue.addManyWithOps(
      repositories.map(repository => ({
        data: { skillRepositoryId: repository.id },
        opts: { id: `drift:${repository.id}` }
      }))
    );

    if (repositories.length === pageSize) {
      await skillSyncDriftCheckManyQueue.add(
        { cursor: repositories[repositories.length - 1]!.id },
        hourlyPacedDelay()
      );
    }
  }
);

export let skillSyncDriftCheckSingleQueue = createQueue<{ skillRepositoryId: string }>({
  name: 'cargo/skill/sync/drift-check/single',
  workerOpts: { concurrency: 5, limiter: { max: 10, duration: 1000 } }
});

export let checkSkillRepositoryDrift = async (data: { skillRepositoryId: string }) => {
  let repository = await db.skillRepository.findUnique({
    where: { id: data.skillRepositoryId },
    include: skillRepositoryDestinationInclude
  });
  if (!repository?.lastDriftCheckAt) return;
  if (
    Date.now() - repository.lastDriftCheckAt.getTime() <
    env.skillSync.SKILL_SYNC_DRIFT_CHECK_INTERVAL * 1000
  ) {
    return;
  }

  let destination = getLinkedDestination(repository);
  if (!destination || destination.storageMode !== 'manifest' || !destination.currentManifest) {
    return;
  }
  if (repository.lastPropagatedManifestOid !== destination.currentManifestOid) return;
  if (repository.dismissedManifestSha256 === destination.currentManifest.sha256) return;

  let latest = await getLatestRepositoryPropagation(repository.oid);
  if (latest && [...activePropagationStatuses, 'failed'].includes(latest.status)) return;
  if (await hasActiveContentSync(destination.oid)) return;

  await startRepositoryPropagationSync({
    destinationOid: destination.oid,
    skillRepositoryOid: repository.oid,
    trigger: 'drift_check'
  });
};

export let skillSyncDriftCheckSingleQueueProcessor = skillSyncDriftCheckSingleQueue.process(
  checkSkillRepositoryDrift
);
