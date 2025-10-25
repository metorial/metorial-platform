import { createLoader } from '@metorial/data-hooks';
import { DashboardInstanceServersCapabilitiesListQuery } from '@metorial/generated';
import { withAuth } from '../../user';

export let serverCapabilitiesLoader = createLoader({
  name: 'serverCapabilities',
  parents: [],
  fetch: (i: { instanceId: string } & DashboardInstanceServersCapabilitiesListQuery) =>
    withAuth(sdk => sdk.servers.capabilities.list(i.instanceId, i)),
  mutators: {}
});

export let useServerCapabilities = (
  instanceId: string | null | undefined,
  opts: DashboardInstanceServersCapabilitiesListQuery | undefined | null
) => {
  let data = serverCapabilitiesLoader.use(instanceId && opts ? { instanceId, ...opts } : null);

  return data;
};
