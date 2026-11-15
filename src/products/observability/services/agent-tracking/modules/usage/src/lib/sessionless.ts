import { attributionService } from '@mtsrc/agent-tracking-module-attribution';
import type { AttributionSession } from '@mtsrc/agent-tracking-module-attribution';
import type { SliceAttribution } from './slices';
import type { BaseSlice } from './slices';
import { ATTRIBUTION_VERSION } from '@mtsrc/agent-tracking-layers';

let identityKey = (slice: BaseSlice) =>
  [slice.userId, slice.deviceId, slice.agentId, slice.bucket.toISOString()].join('\u0000');

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

  let keys = [...unique.keys()];
  let results = await attributionService.resolveSessionless({
    organizationId: d.scope.organizationId,
    sessions: [...unique.values()]
  });

  let resolved = new Map<string, SliceAttribution>();
  keys.forEach((key, index) => {
    let result = results[index]!;
    resolved.set(key, {
      entries: result.entries,
      dimIds: result.dimIds,
      version: ATTRIBUTION_VERSION
    });
  });

  return d.slices.map(slice => resolved.get(identityKey(slice))!);
};
