import { DashboardInstanceProvidersToolsListQuery } from '@metorial/dashboard-sdk';
import { createLoader } from '@metorial/data-hooks';
import { autoPaginate } from '../../lib/autoPaginate';
import { withAuth } from '../../user';

export let providerToolsLoader = createLoader({
  name: 'providerTools',
  parents: [],
  fetch: async (i: { instanceId: string } & DashboardInstanceProvidersToolsListQuery) => {
    return await withAuth(sdk =>
      autoPaginate(c => sdk.providers.tools.list(i.instanceId, { ...i, ...c }))
    );
  },
  mutators: {}
});

export let useProviderTools = (
  instanceId: string | null | undefined,
  opts: DashboardInstanceProvidersToolsListQuery | null
) => {
  let data = providerToolsLoader.use(instanceId && opts ? { instanceId, ...opts } : null);

  return {
    ...data,
    data: data.data
      ? {
          items: data.data,
          pagination: {
            hasMoreAfter: false,
            hasMoreBefore: false
          }
        }
      : null
  };
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

export let providerToolsByIdsLoader = createLoader({
  name: 'providerToolsByIds',
  parents: [providerToolsLoader],
  fetch: async (i: { instanceId: string; ids: string[] }) =>
    await withAuth(sdk =>
      Promise.all(i.ids.map(id => sdk.providers.tools.get(i.instanceId, id)))
    ),
  mutators: {}
});

export let useProviderToolsByIds = (
  instanceId: string | null | undefined,
  ids: string[] | null | undefined
) => {
  let uniqueIds = ids?.length ? [...new Set(ids)].sort() : null;

  return providerToolsByIdsLoader.use(
    instanceId && uniqueIds ? { instanceId, ids: uniqueIds } : null
  );
};
