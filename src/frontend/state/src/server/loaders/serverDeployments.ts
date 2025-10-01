import {
  DashboardInstanceServersDeploymentsCreateBody,
  DashboardInstanceServersDeploymentsListQuery,
  DashboardInstanceServersDeploymentsUpdateBody
} from '@metorial/dashboard-sdk/src/gen/src/mt_2025_01_01_dashboard';
import { createLoader } from '@metorial/data-hooks';
import { usePaginator } from '../../lib/usePaginator';
import { withAuth } from '../../user';

export let serverDeploymentsLoader = createLoader({
  name: 'serverDeployments',
  parents: [],
  fetch: (i: { instanceId: string } & DashboardInstanceServersDeploymentsListQuery) =>
    withAuth(sdk => sdk.servers.deployments.list(i.instanceId, i)),
  mutators: {}
});

export let useCreateDeployment = serverDeploymentsLoader.createExternalMutator(
  (i: DashboardInstanceServersDeploymentsCreateBody & { instanceId: string }) =>
    withAuth(sdk => sdk.servers.deployments.create(i.instanceId, i)),
  {
    disableToast: true
  }
);

export let useServerDeployments = (
  instanceId: string | null | undefined,
  query?: DashboardInstanceServersDeploymentsListQuery
) => {
  let data = usePaginator(pagination =>
    serverDeploymentsLoader.use(instanceId ? { instanceId, ...pagination, ...query } : null)
  );

  return data;
};

export let serverDeploymentLoader = createLoader({
  name: 'serverDeployment',
  parents: [serverDeploymentsLoader],
  fetch: (i: { instanceId: string; serverDeploymentId: string }) =>
    withAuth(sdk => sdk.servers.deployments.get(i.instanceId, i.serverDeploymentId)),
  mutators: {
    update: (
      i: DashboardInstanceServersDeploymentsUpdateBody,
      { input: { instanceId, serverDeploymentId } }
    ) => withAuth(sdk => sdk.servers.deployments.update(instanceId, serverDeploymentId, i)),

    delete: (_, { input: { instanceId, serverDeploymentId } }) =>
      withAuth(sdk => sdk.servers.deployments.delete(instanceId, serverDeploymentId))
  }
});

export let useServerDeployment = (
  instanceId: string | null | undefined,
  serverDeploymentId: string | null | undefined
) => {
  let data = serverDeploymentLoader.use(
    instanceId && serverDeploymentId ? { instanceId, serverDeploymentId } : null
  );

  return {
    ...data,
    useUpdateMutator: data.useMutator('update'),
    useDeleteMutator: data.useMutator('delete')
  };
};
