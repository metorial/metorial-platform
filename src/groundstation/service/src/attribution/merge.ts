import { mergeRemapQueue } from '../queues/reattribute';
import { isStoreConfigured } from '../store/connection';
import { invalidateAttributionContext } from './context';

// Other processes' ingest identity caches can keep stamping the loser for up to a minute after
// the merge, so a second pass fixes records written in that window.
export let lateRemapDelayMs = 3 * 60 * 1000;

export let onEntitiesMerged = async (d: {
  organizationId: string;
  winnerId: string;
  loserId: string;
}) => {
  invalidateAttributionContext(d.organizationId);

  if (!isStoreConfigured()) return;

  await mergeRemapQueue.add(d);
  await mergeRemapQueue.add({ ...d, late: true }, { delay: lateRemapDelayMs });
};
