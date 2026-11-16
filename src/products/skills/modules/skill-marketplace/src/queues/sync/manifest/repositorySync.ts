import { generatePlainId } from '@lowerdeck/id';
import type { SkillDestinationSyncTrigger } from '@metorial/db';
import { addAfterTransactionHook, db, ID, withTransaction } from '@metorial/db';
import { createSkillSyncBranchName } from '../_lib/branchName';
import { appendSkillDestinationSyncLog } from '../_lib/logs';
import { syncPropagatePerformQueue } from '../propagate';

let activeSyncStatuses = ['pending', 'processing', 'waiting_for_review'] as const;

export let skillRepositoryDestinationInclude = {
  lastPropagatedManifest: true,
  marketplaceRepository: {
    include: {
      skillMarketplace: { include: { destination: { include: { currentManifest: true } } } }
    }
  },
  pluginRepository: {
    include: {
      skillPlugin: { include: { destination: { include: { currentManifest: true } } } }
    }
  }
} as const;

export let getLatestRepositoryPropagation = async (skillRepositoryOid: bigint) =>
  await db.skillDestinationSyncRepositoryPropagation.findFirst({
    where: {
      skillRepositoryOid,
      NOT: { status: 'canceled', originSyncId: null }
    },
    orderBy: { oid: 'desc' }
  });

export let hasActiveContentSync = async (destinationOid: bigint) =>
  !!(await db.skillDestinationSync.findFirst({
    where: {
      destinationOid,
      status: { in: [...activeSyncStatuses] },
      isAtRepoSyncStage: false
    },
    select: { oid: true }
  }));

// Starts directly at the repository stage with the destination's current manifest. startedAt
// stays null so an older pending content sync isn't cancelled as superseded by this one.
export let startRepositoryPropagationSync = async (d: {
  destinationOid: bigint;
  skillRepositoryOid: bigint;
  trigger: Extract<SkillDestinationSyncTrigger, 'repair' | 'drift_check'>;
}) => {
  let created = await withTransaction(async db => {
    let destination = await db.skillDestination.findUniqueOrThrow({
      where: { oid: d.destinationOid },
      include: { skillMarketplace: true, skillPlugin: true, currentManifest: true }
    });
    if (destination.storageMode !== 'manifest' || !destination.currentManifest) return null;

    let contentSync = await db.skillDestinationSync.findFirst({
      where: { manifestOid: destination.currentManifest.oid, prName: { not: null } },
      orderBy: { oid: 'desc' }
    });
    let repository = await db.skillRepository.update({
      where: { oid: d.skillRepositoryOid },
      data: { syncCounter: { increment: 1 } },
      include: { lastPropagatedManifest: true }
    });

    let target = destination.skillMarketplace ? 'marketplace' : 'skill';
    let prName = contentSync?.prName ?? `Sync ${target}`;
    let sync = await db.skillDestinationSync.create({
      data: {
        id: await ID.generateId('skillDestinationSync'),
        destinationOid: destination.oid,
        status: 'processing',
        trigger: d.trigger,
        storageMode: 'manifest',
        isAtRepoSyncStage: true,
        manifestOid: destination.currentManifest.oid,
        prName,
        prDescription: contentSync?.prDescription,
        commitMessage: contentSync?.commitMessage ?? prName
      }
    });

    let propagation = await db.skillDestinationSyncRepositoryPropagation.create({
      data: {
        id: await ID.generateId('skillDestinationSyncRepositoryPropagation'),
        status: 'pending',
        repositoryAccessMode:
          destination.skillMarketplace?.repositoryAccessMode ?? 'pull_request',
        forceMergeOrPush: destination.skillMarketplace?.forceMergeOrPush ?? false,
        mergeBeforeChecksPass: destination.skillMarketplace?.mergeBeforeChecksPass ?? false,
        manifestOid: destination.currentManifest.oid,
        previousManifestSha256:
          repository.lastPropagatedManifest?.destinationOid === destination.oid
            ? repository.lastPropagatedManifest.sha256
            : null,
        skillDestinationSyncOid: sync.oid,
        skillRepositoryOid: repository.oid,
        branchName: createSkillSyncBranchName({
          target,
          syncCounter: repository.syncCounter,
          suffix: generatePlainId(4)
        }),
        prName,
        prDescription: contentSync?.prDescription,
        commitMessage: contentSync?.commitMessage ?? prName
      }
    });

    addAfterTransactionHook(async () => {
      await syncPropagatePerformQueue.add(
        {
          skillDestinationSyncId: sync.id,
          processedPropagationIds: [],
          pendingPropagationIds: [propagation.id]
        },
        { id: `${sync.id}:perform` }
      );
    });

    return { sync, propagation };
  });
  if (!created) return null;

  await appendSkillDestinationSyncLog(
    created.sync.id,
    d.trigger === 'repair'
      ? 'Retrying a failed repository update.'
      : 'Checking the repository for changes made outside Metorial.'
  );

  return created;
};
