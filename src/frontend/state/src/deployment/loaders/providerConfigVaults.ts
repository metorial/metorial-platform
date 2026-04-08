import {
  DashboardInstanceProviderDeploymentsConfigVaultsCreateBody,
  DashboardInstanceProviderDeploymentsConfigVaultsListQuery,
  DashboardInstanceProviderDeploymentsConfigVaultsUpdateBody
} from '@metorial/dashboard-sdk';
import { createLoader } from '@metorial/data-hooks';
import { usePaginator } from '../../lib/usePaginator';
import { withAuth } from '../../user';

export let providerConfigVaultsLoader = createLoader({
  name: 'providerConfigVaults',
  parents: [],
  fetch: (
    i: { instanceId: string } & DashboardInstanceProviderDeploymentsConfigVaultsListQuery
  ) => withAuth(sdk => sdk.providerDeployments.configVaults.list(i.instanceId, i)),
  mutators: {}
});

export let useCreateProviderConfigVault = providerConfigVaultsLoader.createExternalMutator(
  ({
    instanceId,
    ...body
  }: DashboardInstanceProviderDeploymentsConfigVaultsCreateBody & { instanceId: string }) =>
    withAuth(sdk => sdk.providerDeployments.configVaults.create(instanceId, body)),
  { disableToast: true }
);

export let useDeleteProviderConfigVault = providerConfigVaultsLoader.createExternalMutator(
  (i: { instanceId: string; providerConfigVaultId: string }) =>
    withAuth(sdk => sdk.providerDeployments.configVaults.delete(i.instanceId, i.providerConfigVaultId))
);

export let useProviderConfigVaults = (
  instanceId: string | null | undefined,
  query?: DashboardInstanceProviderDeploymentsConfigVaultsListQuery
) => {
  let data = usePaginator(pagination =>
    providerConfigVaultsLoader.use(
      instanceId
        ? {
            order: 'desc',
            ...query,
            ...pagination,
            instanceId
          }
        : null
    )
  );

  return data;
};

export let providerConfigVaultLoader = createLoader({
  name: 'providerConfigVault',
  parents: [providerConfigVaultsLoader],
  fetch: (i: { instanceId: string; providerConfigVaultId: string }) =>
    withAuth(sdk =>
      sdk.providerDeployments.configVaults.get(i.instanceId, i.providerConfigVaultId)
    ),
  mutators: {
    update: (
      body: DashboardInstanceProviderDeploymentsConfigVaultsUpdateBody,
      { input: { instanceId, providerConfigVaultId } }
    ) =>
      withAuth(sdk =>
        sdk.providerDeployments.configVaults.update(instanceId, providerConfigVaultId, body)
      ),
    delete: (_, { input: { instanceId, providerConfigVaultId } }) =>
      withAuth(sdk => sdk.providerDeployments.configVaults.delete(instanceId, providerConfigVaultId))
  }
});

export let useProviderConfigVault = (
  instanceId: string | null | undefined,
  providerConfigVaultId: string | null | undefined
) => {
  let data = providerConfigVaultLoader.use(
    instanceId && providerConfigVaultId ? { instanceId, providerConfigVaultId } : null
  );

  return {
    ...data,
    useUpdateMutator: data.useMutator('update'),
    useDeleteMutator: data.useMutator('delete')
  };
};
