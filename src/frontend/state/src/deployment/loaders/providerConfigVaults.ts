import {
  DashboardInstanceProviderDeploymentsConfigVaultsCreateBody,
  DashboardInstanceProviderDeploymentsConfigVaultsCreateOutput,
  DashboardInstanceProviderDeploymentsConfigVaultsGetOutput,
  DashboardInstanceProviderDeploymentsConfigVaultsListOutput,
  DashboardInstanceProviderDeploymentsConfigVaultsListQuery,
  DashboardInstanceProviderDeploymentsConfigVaultsUpdateBody
} from '@metorial/dashboard-sdk';
import { createLoader } from '@metorial/data-hooks';
import { usePaginator } from '../../lib/usePaginator';
import { withAuth } from '../../user';

type ProviderConfigVaultsListQuery =
  DashboardInstanceProviderDeploymentsConfigVaultsListQuery;

type ProviderConfigVaultCreateBody =
  DashboardInstanceProviderDeploymentsConfigVaultsCreateBody;

type ProviderConfigVaultUpdateBody =
  DashboardInstanceProviderDeploymentsConfigVaultsUpdateBody;

type ProviderConfigVaultListItem =
  DashboardInstanceProviderDeploymentsConfigVaultsListOutput['items'][number];

type ProviderConfigVaultsPaginatorResult = ReturnType<
  typeof providerConfigVaultsLoader.use
> & {
  data: DashboardInstanceProviderDeploymentsConfigVaultsListOutput | null;
};

export let providerConfigVaultsLoader = createLoader({
  name: 'providerConfigVaults',
  parents: [],
  fetch: (i: { instanceId: string } & ProviderConfigVaultsListQuery) =>
    withAuth(sdk => sdk.providerDeployments.configVaults.list(i.instanceId, i)) as Promise<
      DashboardInstanceProviderDeploymentsConfigVaultsListOutput
    >,
  mutators: {}
});

export let useCreateProviderConfigVault =
  providerConfigVaultsLoader.createExternalMutator(
    ({ instanceId, ...body }: ProviderConfigVaultCreateBody & { instanceId: string }) =>
      withAuth(sdk =>
        sdk.providerDeployments.configVaults.create(instanceId, body)
      ) as Promise<DashboardInstanceProviderDeploymentsConfigVaultsCreateOutput>,
    { disableToast: true }
  );

export let useProviderConfigVaults = (
  instanceId: string | null | undefined,
  query?: ProviderConfigVaultsListQuery
) => {
  let data = usePaginator<ProviderConfigVaultsPaginatorResult, ProviderConfigVaultListItem>(
    pagination =>
      providerConfigVaultsLoader.use(
        instanceId
          ? {
              order: 'desc',
              ...query,
              ...pagination,
              instanceId
            }
          : null
      ) as ProviderConfigVaultsPaginatorResult
  );

  return data;
};

export let providerConfigVaultLoader = createLoader({
  name: 'providerConfigVault',
  parents: [providerConfigVaultsLoader],
  fetch: (i: { instanceId: string; providerConfigVaultId: string }) =>
    withAuth(sdk =>
      sdk.providerDeployments.configVaults.get(i.instanceId, i.providerConfigVaultId)
    ) as Promise<DashboardInstanceProviderDeploymentsConfigVaultsGetOutput>,
  mutators: {
    update: (
      body: ProviderConfigVaultUpdateBody,
      { input: { instanceId, providerConfigVaultId } }
    ) =>
      withAuth(sdk =>
        sdk.providerDeployments.configVaults.update(
          instanceId,
          providerConfigVaultId,
          body
        )
      )
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
    useUpdateMutator: data.useMutator('update')
  };
};
