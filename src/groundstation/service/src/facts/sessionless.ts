import { buildResolveInput, loadAttributionInputs } from '../attribution/context';
import { resolveAttribution } from '../attribution/resolver';
import type { AttributionSession } from '../attribution/types';
import { ATTRIBUTION_VERSION } from '../attribution/versions';
import type { SliceAttribution } from './slices';
import type { BaseSlice } from './write';

let identityKey = (slice: BaseSlice) =>
  [slice.userId, slice.deviceId, slice.agentId, slice.bucket.toISOString()].join('\u0000');

// Sessionless aggregates have no context, rules or classification: they are attributed from
// their observed ids and the links valid at their bucket only (07 §5.6).
export let resolveSessionlessAttributions = async (d: {
  scope: { organizationId: string; projectId: string; instanceId: string };
  slices: BaseSlice[];
}): Promise<SliceAttribution[]> => {
  let sessionOf = (slice: BaseSlice): AttributionSession => ({
    projectId: d.scope.projectId,
    instanceId: d.scope.instanceId,
    startedAt: slice.bucket,
    client: slice.client ?? { family: 'unknown' },
    observed: {
      userId: slice.userId,
      deviceId: slice.deviceId,
      agentId: slice.agentId,
      clientUserIds: [],
      clientInstallationIds: []
    },
    context: { workspaceIds: [], repoIds: [], ticketRefs: [], tags: [], pathStored: false }
  });

  let unique = new Map<string, AttributionSession>();
  for (let slice of d.slices) unique.set(identityKey(slice), sessionOf(slice));

  let loaded = await loadAttributionInputs({
    organizationId: d.scope.organizationId,
    sessions: [...unique.values()]
  });

  let resolved = new Map<string, SliceAttribution>();
  for (let [key, session] of unique) {
    let input = await buildResolveInput({ loaded, session, rules: [], sessionless: true });
    let result = resolveAttribution(input);

    resolved.set(key, {
      entries: result.entries,
      dimIds: result.dimIds,
      version: ATTRIBUTION_VERSION
    });
  }

  return d.slices.map(slice => resolved.get(identityKey(slice))!);
};
