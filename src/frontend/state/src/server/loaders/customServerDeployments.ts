import {
  DashboardInstanceCustomProvidersDeploymentsGetLogsOutput,
  DashboardInstanceCustomProvidersDeploymentsListQuery
} from '@metorial/dashboard-sdk/src/gen/src/mt_2026_02_01_dashboard';
import { createLoader } from '@metorial/data-hooks';
import { useEffect, useRef } from 'react';
import useInterval from 'use-interval';
import { usePaginator } from '../../lib/usePaginator';
import { withAuth } from '../../user';
import { customServerLoader } from './customServers';

export let customServerDeploymentsLoader = createLoader({
  name: 'customServerDeployments',
  parents: [],
  fetch: (
    i: {
      instanceId: string;
      customServerId: string;
    } & DashboardInstanceCustomProvidersDeploymentsListQuery
  ) =>
    withAuth(sdk => sdk.customProviders.deployments.list(i.instanceId, i.customServerId, i)),
  mutators: {}
});

export let useCustomServerDeployments = (
  instanceId: string | null | undefined,
  customServerId: string | null | undefined,
  query?: DashboardInstanceCustomProvidersDeploymentsListQuery
) => {
  let data = usePaginator(pagination =>
    customServerDeploymentsLoader.use(
      instanceId && customServerId
        ? { instanceId, customServerId, ...pagination, ...query }
        : null
    )
  );

  useInterval(() => {
    let hasDeploying = data.data?.items.some(
      (i: { status: string | null }) => i.status == 'deploying' || i.status == 'queued'
    );
    if (!hasDeploying) return;

    data.refetch();
  }, 1000 * 10);

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
      sdk.customProviders.deployments.get(
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

  let inProgressStatuses = ['deploying', 'queued'];
  let isInProgress = data.data?.status ? inProgressStatuses.includes(data.data.status) : false;

  let hasRunningSteps = (data.data as any)?.steps?.some(
    (s: any) => s.status === 'running' || s.status === 'queued'
  );

  useInterval(() => {
    if (!isInProgress && !hasRunningSteps) return;

    data.refetch();
  }, 1000);

  let prevInProgress = useRef(isInProgress);
  useEffect(() => {
    if (prevInProgress.current && !isInProgress && instanceId && customServerId) {
      customServerLoader.refetchAll();
    }
    prevInProgress.current = isInProgress;
  }, [isInProgress]);

  return {
    ...data
  };
};

export let customServerDeploymentLogsLoader = createLoader({
  name: 'customServerDeploymentLogs',
  parents: [customServerDeploymentLoader],
  fetch: (i: {
    instanceId: string;
    customServerId: string;
    customServerDeploymentId: string;
  }) =>
    withAuth(sdk =>
      sdk.customProviders.deployments.getLogs(
        i.instanceId,
        i.customServerId,
        i.customServerDeploymentId
      )
    ),
  mutators: {}
});

export let useCustomServerDeploymentLogs = (
  instanceId: string | null | undefined,
  customServerId: string | null | undefined,
  customServerDeploymentId: string | null | undefined,
  deploymentStatus: string | null | undefined
) => {
  let data = customServerDeploymentLogsLoader.use(
    instanceId && customServerId && customServerDeploymentId
      ? { instanceId, customServerId, customServerDeploymentId }
      : null
  );

  let hasRunningSteps = (data.data as any)?.steps?.some(
    (s: any) => s.status === 'running' || s.status === 'queued'
  );
  let isInProgress =
    deploymentStatus == 'deploying' || deploymentStatus == 'queued' || hasRunningSteps;

  useInterval(() => {
    if (!isInProgress || !customServerDeploymentId) return;

    data.refetch();
  }, 1000 * 3);

  return {
    ...data,
    data:
      data.data ??
      ({
        object: 'custom_provider.deployment.logs',
        logs: [],
        steps: []
      } as DashboardInstanceCustomProvidersDeploymentsGetLogsOutput & { steps: any[] })
  };
};
