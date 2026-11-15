import type {
  SkillDestinationSync,
  SkillDestinationSyncRepositoryPropagation,
  SkillRepository
} from '@metorial/db';
import { db } from '@metorial/db';
import { env } from '../../../env';
import { shouldSkipManifestPropagation } from '../manifest/propagate';
import { getPendingDestinationFileDeletionsWhere } from './deletions';
import { syncFinishQueue } from '../finish';
import { appendSkillDestinationSyncLog } from './logs';

let deliveringPropagationStatuses = ['processing', 'waiting_for_review', 'completed'];

type RepositoryPolicy = Pick<
  SkillDestinationSyncRepositoryPropagation,
  'repositoryAccessMode' | 'forceMergeOrPush' | 'mergeBeforeChecksPass'
>;

type LatestPropagation = RepositoryPolicy &
  Pick<SkillDestinationSyncRepositoryPropagation, 'status' | 'contentRevision'>;

export let canSkipUnchangedSync = (d: {
  sync: Pick<SkillDestinationSync, 'trigger' | 'allowMassDelete'>;
  hasChanges: boolean;
  skillRepositoryId?: string;
}) =>
  d.sync.trigger === 'automatic' &&
  !d.sync.allowMassDelete &&
  !d.hasChanges &&
  !d.skillRepositoryId;

export let isCodeBucketRepositoryCurrent = (d: {
  contentRevision: number;
  policy: RepositoryPolicy;
  latestPropagation: LatestPropagation | null;
  hasPendingDeletions: boolean;
}) =>
  !d.hasPendingDeletions &&
  !!d.latestPropagation &&
  deliveringPropagationStatuses.includes(d.latestPropagation.status) &&
  d.latestPropagation.contentRevision === d.contentRevision &&
  d.latestPropagation.repositoryAccessMode === d.policy.repositoryAccessMode &&
  d.latestPropagation.forceMergeOrPush === d.policy.forceMergeOrPush &&
  d.latestPropagation.mergeBeforeChecksPass === d.policy.mergeBeforeChecksPass;

export let incrementDestinationContentRevision = async (destinationOid: bigint) =>
  await db.skillDestination.update({
    where: { oid: destinationOid },
    data: { contentRevision: { increment: 1 } }
  });

let getDestinationRepositories = async (destinationOid: bigint) => {
  let destination = await db.skillDestination.findUniqueOrThrow({
    where: { oid: destinationOid },
    include: {
      skillMarketplace: {
        include: {
          repositories: {
            include: { skillRepository: { include: { lastPropagatedManifest: true } } }
          }
        }
      },
      skillPlugin: {
        include: {
          repositories: {
            include: { skillRepository: { include: { lastPropagatedManifest: true } } }
          }
        }
      }
    }
  });

  let links =
    destination.skillMarketplace?.repositories ?? destination.skillPlugin?.repositories ?? [];

  return {
    destination,
    repositories: links.map(link => link.skillRepository),
    policy: {
      repositoryAccessMode:
        destination.skillMarketplace?.repositoryAccessMode ?? ('pull_request' as const),
      forceMergeOrPush: destination.skillMarketplace?.forceMergeOrPush ?? false,
      mergeBeforeChecksPass: destination.skillMarketplace?.mergeBeforeChecksPass ?? false
    }
  };
};

let getLatestPropagation = async (d: {
  destinationOid: bigint;
  skillRepository: Pick<SkillRepository, 'oid'>;
  excludeUnstartedCanceled: boolean;
}) =>
  await db.skillDestinationSyncRepositoryPropagation.findFirst({
    where: {
      skillRepositoryOid: d.skillRepository.oid,
      skillDestinationSync: { destinationOid: d.destinationOid },
      ...(d.excludeUnstartedCanceled
        ? { NOT: { status: 'canceled', originSyncId: null } }
        : { status: { not: 'canceled' } })
    },
    orderBy: { oid: 'desc' }
  });

export let areCodeBucketRepositoriesCurrent = async (destinationOid: bigint) => {
  let { destination, repositories, policy } = await getDestinationRepositories(destinationOid);

  for (let skillRepository of repositories) {
    let [latestPropagation, pendingDeletion] = await Promise.all([
      getLatestPropagation({
        destinationOid,
        skillRepository,
        excludeUnstartedCanceled: false
      }),
      db.skillDestinationDeletedFile.findFirst({
        where: getPendingDestinationFileDeletionsWhere({
          destinationOid,
          appliedAt: skillRepository.deletionsAppliedAt,
          upTo: new Date()
        }),
        select: { destinationOid: true }
      })
    ]);

    if (
      !isCodeBucketRepositoryCurrent({
        contentRevision: destination.contentRevision,
        policy,
        latestPropagation,
        hasPendingDeletions: !!pendingDeletion
      })
    ) {
      return false;
    }
  }

  return repositories.length > 0;
};

export let areManifestRepositoriesCurrent = async (d: {
  destinationOid: bigint;
  trigger: SkillDestinationSync['trigger'];
  manifestSha256: string;
}) => {
  let { repositories } = await getDestinationRepositories(d.destinationOid);
  let now = new Date();

  for (let skillRepository of repositories) {
    let latestPropagation = await getLatestPropagation({
      destinationOid: d.destinationOid,
      skillRepository,
      excludeUnstartedCanceled: true
    });

    let skip = shouldSkipManifestPropagation({
      trigger: d.trigger,
      manifestSha256: d.manifestSha256,
      repository: skillRepository,
      previousPropagationStatus: latestPropagation?.status ?? null,
      now,
      driftCheckIntervalMs: env.skillSync.SKILL_SYNC_DRIFT_CHECK_INTERVAL * 1000
    });
    if (!skip) return false;
  }

  return repositories.length > 0;
};

export let finishUnchangedSync = async (d: {
  syncOid: bigint;
  skillDestinationSyncId: string;
}) => {
  await db.skillDestinationSync.update({
    where: { oid: d.syncOid },
    data: { isAtRepoSyncStage: true }
  });
  await appendSkillDestinationSyncLog(
    d.skillDestinationSyncId,
    'No content changed and every repository is already up to date; skipping repository updates.'
  );
  await syncFinishQueue.add({ skillDestinationSyncId: d.skillDestinationSyncId });
};
