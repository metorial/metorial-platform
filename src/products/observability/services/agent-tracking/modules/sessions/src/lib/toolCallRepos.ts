import { recordReadbackService } from '@mtsrc/agent-tracking-module-records';
import type { SessionDocument } from '@mtsrc/agent-tracking-store';
import { collections } from './collections';

export let toolCallRepoOps = (d: {
  session: Pick<SessionDocument, '_id' | 'organizationId' | 'instanceId' | 'context'>;
  repoIds: (string | null)[];
}) => {
  let sessionRepos = d.session.context?.repoIds ?? [];
  let repoId = sessionRepos.length == 1 ? sessionRepos[0]! : null;
  if (d.repoIds.every(current => current === repoId)) return [];

  let filter = {
    organizationId: d.session.organizationId,
    instanceId: d.session.instanceId,
    'ctx.sessionKey': d.session._id,
    type: 'tool.call'
  };

  return [
    repoId
      ? {
          updateMany: {
            filter: { ...filter, 'attribution.repoId': { $ne: repoId } },
            update: { $set: { 'attribution.repoId': repoId } }
          }
        }
      : {
          updateMany: {
            filter: { ...filter, 'attribution.repoId': { $exists: true } },
            update: { $unset: { 'attribution.repoId': '' } }
          }
        }
  ];
};

export let copySessionRepoToToolCalls = async (d: {
  session: Pick<SessionDocument, '_id' | 'organizationId' | 'instanceId' | 'context'>;
  repoIds: (string | null)[];
}) => {
  if (recordReadbackService.isAvailable()) return 0;

  let ops = toolCallRepoOps(d);
  if (!ops.length) return 0;

  let { events } = await collections();
  await events.bulkWrite(ops as never, { ordered: false });

  return ops.length;
};
