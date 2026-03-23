import {
  DashboardInstanceProviderDeploymentsAuthCredentialsCreateBody,
  DashboardInstanceProviderDeploymentsAuthCredentialsGetOutput,
  DashboardInstanceProviderDeploymentsAuthCredentialsListOutput,
  DashboardInstanceProviderDeploymentsAuthCredentialsListQuery,
  DashboardInstanceProviderDeploymentsAuthCredentialsUpdateBody
} from '@metorial/dashboard-sdk';
import { createLoader } from '@metorial/data-hooks';
import { usePaginator } from '../../lib/usePaginator';
import { withAuth } from '../../user';

export type ProviderAuthCredentialsListQuery =
  DashboardInstanceProviderDeploymentsAuthCredentialsListQuery;

export type ProviderAuthCredentialsItem =
  DashboardInstanceProviderDeploymentsAuthCredentialsListOutput['items'][number];

export type ProviderAuthCredentialsListOutput =
  DashboardInstanceProviderDeploymentsAuthCredentialsListOutput;

export type ProviderAuthCredentialOutput =
  DashboardInstanceProviderDeploymentsAuthCredentialsGetOutput;

export let providerAuthCredentialsLoader = createLoader({
  name: 'providerAuthCredentials',
  parents: [],
  fetch: ({ instanceId, ...query }: { instanceId: string } & ProviderAuthCredentialsListQuery) =>
    withAuth(
      async sdk =>
        (await sdk.providerDeployments.authCredentials.list(
          instanceId,
          query as DashboardInstanceProviderDeploymentsAuthCredentialsListQuery
        )) as ProviderAuthCredentialsListOutput
    ),
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

export let useInstanceProviderAuthCredentials = (
  instanceId: string | null | undefined,
  query?: ProviderAuthCredentialsListQuery | null
) => {
  let data = usePaginator(pagination =>
    providerAuthCredentialsLoader.use(
      instanceId && query !== null ? { ...pagination, ...(query ?? {}), instanceId } : null
    )
  );

  return data;
};

export let useProviderAuthCredentials = (
  instanceId: string | null | undefined,
  providerId: string | null | undefined,
  query?: ProviderAuthCredentialsListQuery | null
) =>
  useInstanceProviderAuthCredentials(
    instanceId,
    providerId && query !== null
      ? {
          ...query,
          providerId
        }
      : null
  );

export let providerAuthCredentialLoader = createLoader({
  name: 'providerAuthCredential',
  parents: [providerAuthCredentialsLoader],
  fetch: (i: { instanceId: string; providerAuthCredentialsId: string }) =>
    withAuth(
      async sdk =>
        (await sdk.providerDeployments.authCredentials.get(
          i.instanceId,
          i.providerAuthCredentialsId
        )) as ProviderAuthCredentialOutput
    ),
  mutators: {
    update: (
      body: DashboardInstanceProviderDeploymentsAuthCredentialsUpdateBody,
      { input: { instanceId, providerAuthCredentialsId } }
    ) =>
      withAuth(async sdk =>
        (await sdk.providerDeployments.authCredentials.update(
          instanceId,
          providerAuthCredentialsId,
          body
        )) as ProviderAuthCredentialOutput
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
