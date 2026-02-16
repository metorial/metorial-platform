import {
  DashboardInstanceProviderDeploymentsAuthConfigsCreateBody,
  DashboardInstanceProviderDeploymentsAuthConfigsListQuery,
  DashboardInstanceProviderDeploymentsAuthConfigsUpdateBody
} from '@metorial/dashboard-sdk/src/gen/src/mt_2026_02_01_dashboard';
import { createLoader } from '@metorial/data-hooks';
import { usePaginator } from '../../lib/usePaginator';
import { withAuth } from '../../user';

export let providerAuthConfigsLoader = createLoader({
  name: 'providerAuthConfigs',
  parents: [],
  fetch: (
    i: {
      instanceId: string;
      providerDeploymentId: string;
    } & DashboardInstanceProviderDeploymentsAuthConfigsListQuery
  ) =>
    withAuth(sdk =>
      sdk.providerDeployments.authConfigs.list(i.instanceId, i.providerDeploymentId, i)
    ),
  mutators: {}
});

export let useCreateProviderAuthConfig = providerAuthConfigsLoader.createExternalMutator(
  (
    i: DashboardInstanceProviderDeploymentsAuthConfigsCreateBody & {
      instanceId: string;
      providerDeploymentId: string;
    }
  ) =>
    withAuth(sdk =>
      sdk.providerDeployments.authConfigs.create(i.instanceId, i.providerDeploymentId, i)
    ),
  { disableToast: true }
);

export let useProviderAuthConfigs = (
  instanceId: string | null | undefined,
  providerDeploymentId: string | null | undefined,
  opts?: { providerAuthMethodId?: string; providerAuthCredentialsId?: string }
) => {
  let data = usePaginator(pagination =>
    providerAuthConfigsLoader.use(
      instanceId && providerDeploymentId
        ? {
            instanceId,
            providerDeploymentId,
            ...pagination,
            providerAuthMethodId: opts?.providerAuthMethodId,
            providerAuthCredentialsId: opts?.providerAuthCredentialsId
          }
        : null
    )
  );

  return data;
};

export let providerAuthConfigLoader = createLoader({
  name: 'providerAuthConfig',
  parents: [providerAuthConfigsLoader],
  fetch: (i: {
    instanceId: string;
    providerDeploymentId: string;
    providerAuthConfigId: string;
  }) =>
    withAuth(sdk =>
      sdk.providerDeployments.authConfigs.get(
        i.instanceId,
        i.providerDeploymentId,
        i.providerAuthConfigId
      )
    ),
  mutators: {
    update: (
      body: DashboardInstanceProviderDeploymentsAuthConfigsUpdateBody,
      { input: { instanceId, providerDeploymentId, providerAuthConfigId } }
    ) =>
      withAuth(sdk =>
        sdk.providerDeployments.authConfigs.update(
          instanceId,
          providerDeploymentId,
          providerAuthConfigId,
          body
        )
      ),

    delete: (_, { input: { instanceId, providerDeploymentId, providerAuthConfigId } }) =>
      withAuth(sdk =>
        sdk.providerDeployments.authConfigs.delete(
          instanceId,
          providerDeploymentId,
          providerAuthConfigId
        )
      )
  }
});

export let useProviderAuthConfig = (
  instanceId: string | null | undefined,
  providerDeploymentId: string | null | undefined,
  providerAuthConfigId: string | null | undefined
) => {
  let data = providerAuthConfigLoader.use(
    instanceId && providerDeploymentId && providerAuthConfigId
      ? { instanceId, providerDeploymentId, providerAuthConfigId }
      : null
  );

  return {
    ...data,
    useUpdateMutator: data.useMutator('update'),
    useDeleteMutator: data.useMutator('delete')
  };
};
