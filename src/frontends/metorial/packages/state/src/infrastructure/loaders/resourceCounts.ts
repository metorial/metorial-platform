import type { DashboardInstancesResourceCountsGetQuery } from '@metorial/dashboard-sdk';
import { createLoader } from '@metorial/data-hooks';
import { withAuth } from '../../user';

type ResourceCountQueryResource = DashboardInstancesResourceCountsGetQuery['resource'];
type ArrayItem<T> = T extends (infer Resource)[] ? Resource : T;

export type ResourceCountResource = ArrayItem<ResourceCountQueryResource>;

export let resourceCountsLoader = createLoader({
  name: 'resourceCounts',
  parents: [],
  fetch: (i: { instanceId: string; resource: ResourceCountResource[] }) =>
    withAuth(sdk => sdk.resourceCounts.get(i.instanceId, { resource: i.resource })),
  mutators: {}
});

export let useResourceCounts = (
  instanceId: string | null | undefined,
  resource: ResourceCountResource[]
) => resourceCountsLoader.use(instanceId ? { instanceId, resource } : null);
