import {
  DashboardInstanceProviderDeploymentsCreateBody,
  DashboardInstanceProviderDeploymentsListQuery,
  DashboardInstanceProviderDeploymentsUpdateBody
} from '@metorial/dashboard-sdk';
import { createLoader } from '@metorial/data-hooks';
import { usePaginator } from '../../lib/usePaginator';
import { withAuth } from '../../user';

export let providerDeploymentsLoader = createLoader({
  name: 'providerDeployments',
  parents: [],
  fetch: (i: { instanceId: string } & DashboardInstanceProviderDeploymentsListQuery) =>
    withAuth(sdk => sdk.providerDeployments.list(i.instanceId, i)),
  mutators: {}
});

export let useCreateProviderDeployment = providerDeploymentsLoader.createExternalMutator(
  (i: DashboardInstanceProviderDeploymentsCreateBody & { instanceId: string }) =>
    withAuth(sdk => sdk.providerDeployments.create(i.instanceId, i)),
  { disableToast: true }
);

export let useProviderDeployments = (
  instanceId: string | null | undefined,
  opts?: DashboardInstanceProviderDeploymentsListQuery
) => {
  let data = usePaginator(pagination =>
    providerDeploymentsLoader.use(
      instanceId
        ? {
            instanceId,
            ...pagination,
            ...opts
          }
        : null
    )
  );

  return data;
};

export let providerDeploymentLoader = createLoader({
  name: 'providerDeployment',
  parents: [providerDeploymentsLoader],
  fetch: (i: { instanceId: string; providerDeploymentId: string }) =>
    withAuth(sdk => sdk.providerDeployments.get(i.instanceId, i.providerDeploymentId)),
  mutators: {
    update: (
      body: DashboardInstanceProviderDeploymentsUpdateBody,
      { input: { instanceId, providerDeploymentId } }
    ) =>
      withAuth(sdk => sdk.providerDeployments.update(instanceId, providerDeploymentId, body))
  }
});

export let useProviderDeployment = (
  instanceId: string | null | undefined,
  providerDeploymentId: string | null | undefined
) => {
  let data = providerDeploymentLoader.use(
    instanceId && providerDeploymentId ? { instanceId, providerDeploymentId } : null
  );

  return {
    ...data,
    useUpdateMutator: data.useMutator('update')
  };
};
