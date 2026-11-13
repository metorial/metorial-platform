import {
  Events,
  reattributionEvents,
  type ReattributionRequest
} from '@mtsrc/agent-tracking-events';
import { mergeRemapQueue, reattributeManyQueue } from './queues/reattribute';
import { isStoreConfigured } from '@mtsrc/agent-tracking-store';

// Other processes' ingest identity caches can keep stamping the loser for up to a minute after
// the merge, so a second pass fixes records written in that window.
export let lateRemapDelayMs = 3 * 60 * 1000;

export let queueReattribution = async (request: ReattributionRequest) => {
  if (!isStoreConfigured()) return;
  if (request.entityIds && !request.entityIds.length) return;

  await reattributeManyQueue.add({
    organizationId: request.organizationId,
    since: request.since.toISOString(),
    entityIds: request.entityIds ? [...new Set(request.entityIds)] : undefined,
    scope: request.scope
  });
};

for (let event of reattributionEvents) Events.listen(event, queueReattribution);

Events.listen(
  'entities.entity.merged:after',
  async ({ organizationId, winnerId, loserId }) => {
    if (!isStoreConfigured()) return;

    let job = { organizationId, winnerId, loserId };
    await mergeRemapQueue.add(job);
    await mergeRemapQueue.add({ ...job, late: true }, { delay: lateRemapDelayMs });
  }
);
