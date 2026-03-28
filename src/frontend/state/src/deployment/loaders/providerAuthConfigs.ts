import {
  DashboardInstanceProviderDeploymentsAuthConfigsCreateBody,
  DashboardInstanceProviderDeploymentsAuthConfigsListOutput,
  DashboardInstanceProviderDeploymentsAuthConfigsListQuery,
  DashboardInstanceProviderDeploymentsAuthConfigsUpdateBody
} from '@metorial/dashboard-sdk';
import { createLoader } from '@metorial/data-hooks';
import { usePaginator } from '../../lib/usePaginator';
import { withAuth } from '../../user';

export let instanceProviderAuthConfigsLoader = createLoader({
  name: 'instanceProviderAuthConfigs',
  parents: [],
  fetch: (
    i: { instanceId: string } & DashboardInstanceProviderDeploymentsAuthConfigsListQuery
  ) =>
    withAuth(sdk =>
      sdk.providerDeployments.authConfigs.list(i.instanceId, i)
    ) as Promise<DashboardInstanceProviderDeploymentsAuthConfigsListOutput>,
  mutators: {}
});

export let useCreateProviderAuthConfig =
  instanceProviderAuthConfigsLoader.createExternalMutator(
    (
      i: DashboardInstanceProviderDeploymentsAuthConfigsCreateBody & {
        instanceId: string;
      }
    ) => withAuth(sdk => sdk.providerDeployments.authConfigs.create(i.instanceId, i)),
    { disableToast: true }
  );

export let useProviderAuthConfigs = (
  instanceId: string | null | undefined,
  opts?: DashboardInstanceProviderDeploymentsAuthConfigsListQuery
) => {
  let data = usePaginator(pagination =>
    instanceProviderAuthConfigsLoader.use(
      instanceId
        ? {
            order: 'desc',
            ...opts,
            ...pagination,
            instanceId
          }
        : null
    )
  );

  return data;
};

export let providerAuthConfigLoader = createLoader({
  name: 'providerAuthConfig',
  parents: [instanceProviderAuthConfigsLoader],
  fetch: (i: { instanceId: string; providerAuthConfigId: string }) =>
    withAuth(sdk =>
      sdk.providerDeployments.authConfigs.get(i.instanceId, i.providerAuthConfigId)
    ),
  mutators: {
    update: (
      body: DashboardInstanceProviderDeploymentsAuthConfigsUpdateBody,
      { input: { instanceId, providerAuthConfigId } }
    ) =>
      withAuth(sdk =>
        sdk.providerDeployments.authConfigs.update(instanceId, providerAuthConfigId, body)
      )
  }
});

export let useProviderAuthConfig = (
  instanceId: string | null | undefined,
  providerAuthConfigId: string | null | undefined
) => {
  let data = providerAuthConfigLoader.use(
    instanceId && providerAuthConfigId ? { instanceId, providerAuthConfigId } : null
  );

  return {
    ...data,
    useUpdateMutator: data.useMutator('update')
  };
};
