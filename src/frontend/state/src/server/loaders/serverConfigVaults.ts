import {
  DashboardInstanceProviderDeploymentsConfigVaultsCreateBody,
  DashboardInstanceProviderDeploymentsConfigVaultsListQuery,
  DashboardInstanceProviderDeploymentsConfigVaultsUpdateBody
} from '@metorial/dashboard-sdk/src/gen/src/mt_2026_02_01_dashboard';
import { createLoader } from '@metorial/data-hooks';
import { usePaginator } from '../../lib/usePaginator';
import { withAuth } from '../../user';

// Provider API - config vaults are scoped to provider deployments
export let providerConfigVaultsLoader = createLoader({
  name: 'providerConfigVaults',
  parents: [],
  fetch: (
    i: {
      instanceId: string;
      providerDeploymentId: string;
    } & DashboardInstanceProviderDeploymentsConfigVaultsListQuery
  ) =>
    withAuth(sdk =>
      sdk.providerDeployments.configVaults.list(i.instanceId, i.providerDeploymentId, i)
    ),
  mutators: {}
});

export let useCreateProviderConfigVault = providerConfigVaultsLoader.createExternalMutator(
  (
    i: DashboardInstanceProviderDeploymentsConfigVaultsCreateBody & {
      instanceId: string;
      providerDeploymentId: string;
    }
  ) =>
    withAuth(sdk =>
      sdk.providerDeployments.configVaults.create(i.instanceId, i.providerDeploymentId, i)
    ),
  {
    disableToast: true
  }
);

export let useProviderConfigVaults = (
  instanceId: string | null | undefined,
  providerDeploymentId: string | null | undefined,
  query?: DashboardInstanceProviderDeploymentsConfigVaultsListQuery
) => {
  let data = usePaginator(pagination =>
    providerConfigVaultsLoader.use(
      instanceId && providerDeploymentId
        ? { instanceId, providerDeploymentId, ...pagination, ...query }
        : null
    )
  );

  return data;
};

export let providerConfigVaultLoader = createLoader({
  name: 'providerConfigVault',
  parents: [providerConfigVaultsLoader],
  fetch: (i: {
    instanceId: string;
    providerDeploymentId: string;
    providerConfigVaultId: string;
  }) =>
    withAuth(sdk =>
      sdk.providerDeployments.configVaults.get(
        i.instanceId,
        i.providerDeploymentId,
        i.providerConfigVaultId
      )
    ),
  mutators: {
    update: (
      i: DashboardInstanceProviderDeploymentsConfigVaultsUpdateBody,
      { input: { instanceId, providerDeploymentId, providerConfigVaultId } }
    ) =>
      withAuth(sdk =>
        sdk.providerDeployments.configVaults.update(
          instanceId,
          providerDeploymentId,
          providerConfigVaultId,
          i
        )
      )
  }
});

export let useProviderConfigVault = (
  instanceId: string | null | undefined,
  providerDeploymentId: string | null | undefined,
  providerConfigVaultId: string | null | undefined
) => {
  let data = providerConfigVaultLoader.use(
    instanceId && providerDeploymentId && providerConfigVaultId
      ? { instanceId, providerDeploymentId, providerConfigVaultId }
      : null
  );

  return {
    ...data,
    useUpdateMutator: data.useMutator('update')
  };
};
