import {
  DashboardInstanceProviderDeploymentsConfigsCreateBody,
  DashboardInstanceProviderDeploymentsConfigsListQuery,
  DashboardInstanceProviderDeploymentsConfigsUpdateBody
} from '@metorial/dashboard-sdk';
import { createLoader } from '@metorial/data-hooks';
import { usePaginator } from '../../lib/usePaginator';
import { withAuth } from '../../user';

type ProviderConfigsQuery = Omit<
  DashboardInstanceProviderDeploymentsConfigsListQuery,
  'providerDeploymentId'
>;

export let providerConfigsLoader = createLoader({
  name: 'providerConfigs',
  parents: [],
  fetch: (
    i: {
      instanceId: string;
      providerDeploymentId: string;
    } & ProviderConfigsQuery
  ) => withAuth(sdk => sdk.providerDeployments.configs.list(i.instanceId, i)),
  mutators: {}
});

export let useCreateProviderConfig = providerConfigsLoader.createExternalMutator(
  (
    i: DashboardInstanceProviderDeploymentsConfigsCreateBody & {
      instanceId: string;
      providerDeploymentId: string;
    }
  ) => withAuth(sdk => sdk.providerDeployments.configs.create(i.instanceId, i)),
  { disableToast: true }
);

export let useProviderConfigs = (
  instanceId: string | null | undefined,
  providerDeploymentId: string | null | undefined,
  query?: ProviderConfigsQuery
) => {
  let data = usePaginator(pagination =>
    providerConfigsLoader.use(
      instanceId && providerDeploymentId
        ? { instanceId, providerDeploymentId, ...pagination, ...query }
        : null
    )
  );

  return data;
};

export let providerConfigLoader = createLoader({
  name: 'providerConfig',
  parents: [providerConfigsLoader],
  fetch: (i: { instanceId: string; providerDeploymentId: string; providerConfigId: string }) =>
    withAuth(sdk => sdk.providerDeployments.configs.get(i.instanceId, i.providerConfigId)),
  mutators: {
    update: (
      body: DashboardInstanceProviderDeploymentsConfigsUpdateBody,
      { input: { instanceId, providerConfigId } }
    ) =>
      withAuth(sdk =>
        sdk.providerDeployments.configs.update(instanceId, providerConfigId, body)
      )
  }
});

export let useProviderConfig = (
  instanceId: string | null | undefined,
  providerDeploymentId: string | null | undefined,
  providerConfigId: string | null | undefined
) => {
  let data = providerConfigLoader.use(
    instanceId && providerDeploymentId && providerConfigId
      ? { instanceId, providerDeploymentId, providerConfigId }
      : null
  );

  return {
    ...data,
    useUpdateMutator: data.useMutator('update')
  };
};
