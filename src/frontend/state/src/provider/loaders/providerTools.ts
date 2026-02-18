import { DashboardInstanceProvidersToolsListQuery } from '@metorial/dashboard-sdk/src/gen/src/mt_2025_01_01_dashboard';
import { createLoader } from '@metorial/data-hooks';
import { usePaginator } from '../../lib/usePaginator';
import { withAuth } from '../../user';

export let providerToolsLoader = createLoader({
  name: 'providerTools',
  parents: [],
  fetch: (
    i: { instanceId: string; providerId: string } & DashboardInstanceProvidersToolsListQuery
  ) => withAuth(sdk => sdk.providers.tools.list(i.instanceId, i.providerId, i)),
  mutators: {}
});

export let useProviderTools = (
  instanceId: string | null | undefined,
  providerId: string | null | undefined,
  opts?: DashboardInstanceProvidersToolsListQuery
) => {
  let data = usePaginator(pagination =>
    providerToolsLoader.use(
      instanceId && providerId
        ? {
            instanceId,
            providerId,
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
  fetch: (i: { instanceId: string; providerId: string; providerToolId: string }) =>
    withAuth(sdk => sdk.providers.tools.get(i.instanceId, i.providerId, i.providerToolId)),
  mutators: {}
});

export let useProviderTool = (
  instanceId: string | null | undefined,
  providerId: string | null | undefined,
  providerToolId: string | null | undefined
) => {
  let data = providerToolLoader.use(
    instanceId && providerId && providerToolId
      ? { instanceId, providerId, providerToolId }
      : null
  );

  return data;
};
