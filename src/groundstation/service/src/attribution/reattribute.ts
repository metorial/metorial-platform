import { reattributeManyQueue } from '../queues/reattribute';
import { isStoreConfigured } from '../store/connection';
import { invalidateAttributionContext } from './context';

export type ReattributionRequest = {
  organizationId: string;
  since: Date;
  entityIds?: string[];
  ruleIds?: string[];
  scope?: { projectId?: string; instanceId?: string };
};

// Link and membership changes pass the entities they touched; rule and kind changes pass none,
// which re-attributes every session of the scope that started since `since` (07 §6.2).
export let requestReattribution = async (request: ReattributionRequest) => {
  invalidateAttributionContext(request.organizationId);

  if (!isStoreConfigured()) return;
  if (request.entityIds && !request.entityIds.length) return;

  await reattributeManyQueue.add({
    organizationId: request.organizationId,
    since: request.since.toISOString(),
    entityIds: request.entityIds ? [...new Set(request.entityIds)] : undefined,
    scope: request.scope
  });
};
