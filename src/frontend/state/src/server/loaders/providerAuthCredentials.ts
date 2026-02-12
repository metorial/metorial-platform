import {
  DashboardInstanceProviderDeploymentsAuthCredentialsCreateBody,
  DashboardInstanceProviderDeploymentsAuthCredentialsListQuery,
  DashboardInstanceProviderDeploymentsAuthCredentialsUpdateBody
} from '@metorial/dashboard-sdk/src/gen/src/mt_2026_02_01_dashboard';
import { createLoader } from '@metorial/data-hooks';
import { usePaginator } from '../../lib/usePaginator';
import { withAuth } from '../../user';

export let providerAuthCredentialsLoader = createLoader({
  name: 'providerAuthCredentials',
  parents: [],
  fetch: (
    i: { instanceId: string; providerDeploymentId: string } &
      DashboardInstanceProviderDeploymentsAuthCredentialsListQuery
  ) =>
    withAuth(sdk =>
      sdk.providerDeployments.authCredentials.list(i.instanceId, i.providerDeploymentId, i)
    ),
  mutators: {}
});

export let useCreateProviderAuthCredentials = providerAuthCredentialsLoader.createExternalMutator(
  ({
    instanceId,
    providerDeploymentId,
    ...body
  }: DashboardInstanceProviderDeploymentsAuthCredentialsCreateBody & {
    instanceId: string;
    providerDeploymentId: string;
  }) =>
    withAuth(sdk =>
      sdk.providerDeployments.authCredentials.create(instanceId, providerDeploymentId, body)
    ),
  { disableToast: true }
);

export let useProviderAuthCredentials = (
  instanceId: string | null | undefined,
  providerDeploymentId: string | null | undefined,
  query?: DashboardInstanceProviderDeploymentsAuthCredentialsListQuery
) => {
  let data = usePaginator(pagination =>
    providerAuthCredentialsLoader.use(
      instanceId && providerDeploymentId
        ? {
            instanceId,
            providerDeploymentId,
            ...pagination,
            ...query
          }
        : null
    )
  );

  return data;
};

export let providerAuthCredentialLoader = createLoader({
  name: 'providerAuthCredential',
  parents: [providerAuthCredentialsLoader],
  fetch: (i: {
    instanceId: string;
    providerDeploymentId: string;
    providerAuthCredentialsId: string;
  }) =>
    withAuth(sdk =>
      sdk.providerDeployments.authCredentials.get(
        i.instanceId,
        i.providerDeploymentId,
        i.providerAuthCredentialsId
      )
    ),
  mutators: {
    update: (
      body: DashboardInstanceProviderDeploymentsAuthCredentialsUpdateBody,
      { input: { instanceId, providerDeploymentId, providerAuthCredentialsId } }
    ) =>
      withAuth(sdk =>
        sdk.providerDeployments.authCredentials.update(
          instanceId,
          providerDeploymentId,
          providerAuthCredentialsId,
          body
        )
      ),

    delete: (_, { input: { instanceId, providerDeploymentId, providerAuthCredentialsId } }) =>
      withAuth(sdk =>
        sdk.providerDeployments.authCredentials.delete(
          instanceId,
          providerDeploymentId,
          providerAuthCredentialsId
        )
      )
  }
});

export let useProviderAuthCredential = (
  instanceId: string | null | undefined,
  providerDeploymentId: string | null | undefined,
  providerAuthCredentialsId: string | null | undefined
) => {
  let data = providerAuthCredentialLoader.use(
    instanceId && providerDeploymentId && providerAuthCredentialsId
      ? { instanceId, providerDeploymentId, providerAuthCredentialsId }
      : null
  );

  return {
    ...data,
    useUpdateMutator: data.useMutator('update'),
    useDeleteMutator: data.useMutator('delete')
  };
};
