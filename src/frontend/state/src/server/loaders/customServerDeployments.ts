import { DashboardInstanceCustomServersDeploymentsListQuery } from '@metorial/dashboard-sdk/src/gen/src/mt_2025_01_01_dashboard';
import { createLoader } from '@metorial/data-hooks';
import { usePaginator } from '../../lib/usePaginator';
import { withAuth } from '../../user';

export let customServerDeploymentsLoader = createLoader({
  name: 'customServerDeployments',
  parents: [],
  fetch: (
    i: {
      instanceId: string;
      customServerId: string;
    } & DashboardInstanceCustomServersDeploymentsListQuery
  ) => withAuth(sdk => sdk.customServers.deployments.list(i.instanceId, i.customServerId, i)),
  mutators: {}
});

export let useCustomServerDeployments = (
  instanceId: string | null | undefined,
  customServerId: string | null | undefined,
  query?: DashboardInstanceCustomServersDeploymentsListQuery
) => {
  let data = usePaginator(pagination =>
    customServerDeploymentsLoader.use(
      instanceId && customServerId
        ? { instanceId, customServerId, ...pagination, ...query }
        : null
    )
  );

  return data;
};

export let customServerDeploymentLoader = createLoader({
  name: 'customServerDeployment',
  parents: [customServerDeploymentsLoader],
  fetch: (i: {
    instanceId: string;
    customServerId: string;
    customServerDeploymentId: string;
  }) =>
    withAuth(sdk =>
      sdk.customServers.deployments.get(
        i.instanceId,
        i.customServerId,
        i.customServerDeploymentId
      )
    ),
  mutators: {}
});

export let useCustomServerDeployment = (
  instanceId: string | null | undefined,
  customServerId: string | null | undefined,
  customServerDeploymentId: string | null | undefined
) => {
  let data = customServerDeploymentLoader.use(
    instanceId && customServerDeploymentId && customServerId
      ? { instanceId, customServerId, customServerDeploymentId }
      : null
  );

  return {
    ...data
  };
};
