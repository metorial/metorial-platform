import { listedSessionFilter } from '@mtsrc/agent-tracking-store';
import type { Organization } from '@mtsrc/agent-tracking-db';

export let sessionStates = ['active', 'idle', 'ended'] as const;

export type SessionListFilters = {
  projectIds?: string[];
  instanceIds?: string[];
  userIds?: (string | null)[];
  deviceIds?: string[];
  agentIds?: string[];
  modelIds?: (string | null)[];
  clientFamilies?: string[];
  repoIds?: string[];
  branches?: string[];
  ticketRefs?: string[];
  pullRequests?: string[];
  metorialProviderIds?: string[];
  states?: (typeof sessionStates)[number][];
  from?: Date;
  to?: Date;
  lastActivityFrom?: Date;
  lastActivityTo?: Date;
};

// A null among the values also matches documents without the field, as `$in` does.
let inFilter = (values: (string | null)[] | undefined) =>
  values ? { $in: values } : undefined;

// A null selects sessions with a model outside the catalog, not sessions without models. The
// missing field is matched explicitly: DocumentDB is not known to treat null like MongoDB.
let modelFilter = (modelIds: (string | null)[] | undefined) =>
  modelIds?.includes(null)
    ? {
        'summary.models': {
          $elemMatch: {
            $or: [
              { modelId: { $in: modelIds.filter(id => id !== null) } },
              { modelId: { $exists: false } },
              { modelId: null }
            ]
          }
        }
      }
    : { 'summary.models.modelId': inFilter(modelIds) };

let defined = (filter: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(filter).filter(([, value]) => value !== undefined));

export let sessionScopeFilter = (
  organization: Pick<Organization, 'id'>,
  filters: SessionListFilters
) =>
  defined({
    organizationId: organization.id,
    projectId: inFilter(filters.projectIds),
    instanceId: inFilter(filters.instanceIds)
  });

let range = (from: Date | undefined, to: Date | undefined) =>
  from || to ? { ...(from ? { $gte: from } : {}), ...(to ? { $lt: to } : {}) } : undefined;

export let sessionListFilter = (
  organization: Pick<Organization, 'id'>,
  filters: SessionListFilters
) =>
  defined({
    ...sessionScopeFilter(organization, filters),
    ...listedSessionFilter,
    'observed.userId': inFilter(filters.userIds),
    'observed.deviceId': inFilter(filters.deviceIds),
    'observed.agentId': inFilter(filters.agentIds),
    ...modelFilter(filters.modelIds),
    'client.family': inFilter(filters.clientFamilies),
    'context.repoIds': inFilter(filters.repoIds),
    'context.branch': inFilter(filters.branches),
    'context.ticketRefs': inFilter(filters.ticketRefs),
    'summary.pullRequestRefs.key': inFilter(filters.pullRequests),
    'summary.metorial.providerIds': inFilter(filters.metorialProviderIds),
    state: inFilter(filters.states),
    startedAt: range(filters.from, filters.to),
    lastActivityAt: range(filters.lastActivityFrom, filters.lastActivityTo)
  });
