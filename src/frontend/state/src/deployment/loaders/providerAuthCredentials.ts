import {
  DashboardInstanceProviderDeploymentsAuthCredentialsCreateBody,
  DashboardInstanceProviderDeploymentsAuthCredentialsListQuery,
  DashboardInstanceProviderDeploymentsAuthCredentialsUpdateBody
} from '@metorial/dashboard-sdk';
import { createLoader } from '@metorial/data-hooks';
import { usePaginator } from '../../lib/usePaginator';
import { withAuth } from '../../user';

export let providerAuthCredentialsLoader = createLoader({
  name: 'providerAuthCredentials',
  parents: [],
  fetch: (
    i: {
      instanceId: string;
      providerId: string;
    } & DashboardInstanceProviderDeploymentsAuthCredentialsListQuery
  ) =>
    withAuth(sdk => sdk.providerDeployments.authCredentials.list(i.instanceId, i)),
  mutators: {}
});

export let useCreateProviderAuthCredentials =
  providerAuthCredentialsLoader.createExternalMutator(
    ({
      instanceId,
      ...body
    }: DashboardInstanceProviderDeploymentsAuthCredentialsCreateBody & {
      instanceId: string;
      providerId: string;
    }) =>
      withAuth(sdk => sdk.providerDeployments.authCredentials.create(instanceId, body)),
    { disableToast: true }
  );

export let useProviderAuthCredentials = (
  instanceId: string | null | undefined,
  providerId: string | null | undefined,
  query?: DashboardInstanceProviderDeploymentsAuthCredentialsListQuery
) => {
  let data = usePaginator(pagination =>
    providerAuthCredentialsLoader.use(
      instanceId && providerId
        ? {
            ...pagination,
            ...query,
            instanceId,
            providerId
          }
        : null
    )
  );

  return data;
};

export let providerAuthCredentialLoader = createLoader({
  name: 'providerAuthCredential',
  parents: [providerAuthCredentialsLoader],
  fetch: (i: { instanceId: string; providerAuthCredentialsId: string }) =>
    withAuth(sdk =>
      sdk.providerDeployments.authCredentials.get(i.instanceId, i.providerAuthCredentialsId)
    ),
  mutators: {
    update: (
      body: DashboardInstanceProviderDeploymentsAuthCredentialsUpdateBody,
      { input: { instanceId, providerAuthCredentialsId } }
    ) =>
      withAuth(sdk =>
        sdk.providerDeployments.authCredentials.update(
          instanceId,
          providerAuthCredentialsId,
          body
        )
      )
  }
});

export let useProviderAuthCredential = (
  instanceId: string | null | undefined,
  providerAuthCredentialsId: string | null | undefined
) => {
  let data = providerAuthCredentialLoader.use(
    instanceId && providerAuthCredentialsId
      ? { instanceId, providerAuthCredentialsId }
      : null
  );

  return {
    ...data,
    useUpdateMutator: data.useMutator('update')
  };
};
