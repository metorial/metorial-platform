import { DashboardInstanceProvidersToolsListQuery } from '@metorial/dashboard-sdk';
import { createLoader } from '@metorial/data-hooks';
import { usePaginator } from '../../lib/usePaginator';
import { withAuth } from '../../user';

export let providerToolsLoader = createLoader({
  name: 'providerTools',
  parents: [],
  fetch: async (i: { instanceId: string } & DashboardInstanceProvidersToolsListQuery) => {
    return await withAuth(sdk => sdk.providers.tools.list(i.instanceId, i));
  },
  mutators: {}
});

export let useProviderTools = (
  instanceId: string | null | undefined,
  opts: DashboardInstanceProvidersToolsListQuery | null
) => {
  let data = usePaginator(pagination =>
    providerToolsLoader.use(
      instanceId && opts
        ? {
            instanceId,
            ...opts,
            ...pagination
          }
        : null
    )
  );

  return data;
};

export let providerToolLoader = createLoader({
  name: 'providerTool',
  parents: [providerToolsLoader],
  fetch: async (i: { instanceId: string; providerToolId: string }) => {
    return await withAuth(sdk => sdk.providers.tools.get(i.instanceId, i.providerToolId));
  },
  mutators: {}
});

export let useProviderTool = (
  instanceId: string | null | undefined,
  providerToolId: string | null | undefined
) => {
  let data = providerToolLoader.use(
    instanceId && providerToolId ? { instanceId, providerToolId } : null
  );

  return data;
};
