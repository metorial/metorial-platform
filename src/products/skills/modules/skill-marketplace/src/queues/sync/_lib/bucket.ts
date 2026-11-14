import { db, type SkillDestinationSync } from '@metorial/db';
import { getOriginTenant, origin } from '@metorial/skills-scm-utils';

// Origin reads the shared bucket asynchronously. Keep it unchanged until every earlier
// request has consumed it; pull requests can then wait for review without blocking edits.
export let destinationBucketIsAvailable = async (
  sync: Pick<SkillDestinationSync, 'oid' | 'destinationOid'>
) => {
  let propagations = await db.skillDestinationSyncRepositoryPropagation.findMany({
    where: {
      status: { in: ['pending', 'processing'] },
      OR: [
        { skillDestinationSync: { status: { in: ['processing', 'waiting_for_review'] } } },
        { originSyncId: { not: null } }
      ],
      skillDestinationSync: {
        destinationOid: sync.destinationOid,
        oid: { lt: sync.oid },
        isAtRepoSyncStage: true
      }
    },
    include: { skillRepository: { include: { project: true } } }
  });
  if (!propagations.length) return true;
  if (propagations.some(propagation => !propagation.originSyncId)) return false;

  let tenant = await getOriginTenant(propagations[0]!.skillRepository.project);
  let remote = await origin.scmRepositorySync.getMany({
    tenantId: tenant.id,
    scmRepositorySyncIds: propagations.map(propagation => propagation.originSyncId!)
  });
  let byId = new Map(remote.syncs.map(item => [item.id, item]));

  return propagations.every(propagation => {
    let status = byId.get(propagation.originSyncId!)?.status;
    return status && !['pending', 'creating_branch', 'syncing_contents'].includes(status);
  });
};
