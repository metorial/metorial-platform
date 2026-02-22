import { DashboardInstanceProvidersToolsListQuery } from '@metorial/dashboard-sdk';
import { createLoader } from '@metorial/data-hooks';
import { usePaginator } from '../../lib/usePaginator';
import { withAuth } from '../../user';

type ProviderToolsQuery = Omit<DashboardInstanceProvidersToolsListQuery, 'providerVersionId'>;

export let providerToolsLoader = createLoader({
  name: 'providerTools',
  parents: [],
  fetch: (
    i: { instanceId: string; providerVersionId: string } & ProviderToolsQuery
  ) => withAuth(sdk => sdk.providers.tools.list(i.instanceId, i)),
  mutators: {}
});

export let useProviderTools = (
  instanceId: string | null | undefined,
  providerVersionId: string | null | undefined,
  opts?: ProviderToolsQuery
) => {
  let data = usePaginator(pagination =>
    providerToolsLoader.use(
      instanceId && providerVersionId
        ? {
            instanceId,
            providerVersionId,
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
  fetch: (i: { instanceId: string; providerToolId: string }) =>
    withAuth(sdk => sdk.providers.tools.get(i.instanceId, i.providerToolId)),
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
