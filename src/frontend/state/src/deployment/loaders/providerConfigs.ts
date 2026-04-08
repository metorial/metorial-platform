import {
  DashboardInstanceProviderDeploymentsConfigsCreateBody,
  DashboardInstanceProviderDeploymentsConfigsListQuery,
  DashboardInstanceProviderDeploymentsConfigsUpdateBody
} from '@metorial/dashboard-sdk';
import { createLoader } from '@metorial/data-hooks';
import { usePaginator } from '../../lib/usePaginator';
import { withAuth } from '../../user';

type ProviderConfigsQuery = DashboardInstanceProviderDeploymentsConfigsListQuery;

export let providerConfigsLoader = createLoader({
  name: 'providerConfigs',
  parents: [],
  fetch: (i: { instanceId: string } & ProviderConfigsQuery) =>
    withAuth(sdk => sdk.providerDeployments.configs.list(i.instanceId, i)),
  mutators: {}
});

export let useCreateProviderConfig = providerConfigsLoader.createExternalMutator(
  (
    i: DashboardInstanceProviderDeploymentsConfigsCreateBody & {
      instanceId: string;
    }
  ) => withAuth(sdk => sdk.providerDeployments.configs.create(i.instanceId, i)),
  { disableToast: true }
);

export let useDeleteProviderConfig = providerConfigsLoader.createExternalMutator(
  (i: { instanceId: string; providerConfigId: string }) =>
    withAuth(sdk => sdk.providerDeployments.configs.delete(i.instanceId, i.providerConfigId))
);

export let useProviderConfigs = (
  instanceId: string | null | undefined,
  query?: ProviderConfigsQuery | null
) => {
  let data = usePaginator(pagination =>
    providerConfigsLoader.use(
      instanceId && query !== null ? { instanceId, ...pagination, ...(query ?? {}) } : null
    )
  );

  return data;
};

export let providerConfigLoader = createLoader({
  name: 'providerConfig',
  parents: [providerConfigsLoader],
  fetch: (i: { instanceId: string; providerConfigId: string }) =>
    withAuth(sdk => sdk.providerDeployments.configs.get(i.instanceId, i.providerConfigId)),
  mutators: {
    update: (
      body: DashboardInstanceProviderDeploymentsConfigsUpdateBody,
      { input: { instanceId, providerConfigId } }
    ) =>
      withAuth(sdk =>
        sdk.providerDeployments.configs.update(instanceId, providerConfigId, body)
      ),
    delete: (_, { input: { instanceId, providerConfigId } }) =>
      withAuth(sdk => sdk.providerDeployments.configs.delete(instanceId, providerConfigId))
  }
});

export let useProviderConfig = (
  instanceId: string | null | undefined,
  providerConfigId: string | null | undefined
) => {
  let data = providerConfigLoader.use(
    instanceId && providerConfigId ? { instanceId, providerConfigId } : null
  );

  return {
    ...data,
    useUpdateMutator: data.useMutator('update'),
    useDeleteMutator: data.useMutator('delete')
  };
};
