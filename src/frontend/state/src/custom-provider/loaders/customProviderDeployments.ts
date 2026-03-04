import { DashboardInstanceCustomProvidersDeploymentsListQuery } from '@metorial/dashboard-sdk';
import { createLoader } from '@metorial/data-hooks';
import { useEffect, useRef } from 'react';
import { usePaginator } from '../../lib/usePaginator';
import { withAuth } from '../../user';
import { customProviderLoader } from './customProviders';

type CustomProviderDeploymentsQuery = Omit<
  DashboardInstanceCustomProvidersDeploymentsListQuery,
  'customProviderId'
>;

export let customProviderDeploymentsLoader = createLoader({
  name: 'customProviderDeployments',
  parents: [],
  fetch: (
    i: {
      instanceId: string;
      customProviderId: string;
    } & CustomProviderDeploymentsQuery
  ) =>
    withAuth(sdk => {
      let { customProviderId, ...query } = i;
      return sdk.customProviders.deployments.list(i.instanceId, {
        ...query,
        customProviderId
      });
    }),
  mutators: {}
});

export let useCustomProviderDeployments = (
  instanceId: string | null | undefined,
  customProviderId: string | null | undefined,
  query?: CustomProviderDeploymentsQuery
) => {
  let data = usePaginator(pagination =>
    customProviderDeploymentsLoader.use(
      instanceId && customProviderId
        ? { instanceId, customProviderId, ...pagination, ...query }
        : null
    )
  );

  let refetchRef = useRef(data.refetch);
  refetchRef.current = data.refetch;
  let hasDeploying = data.data?.items.some(
    (i: { status: string | null }) => i.status == 'deploying' || i.status == 'queued'
  );
  useEffect(() => {
    if (!hasDeploying) return;
    let id = setInterval(() => refetchRef.current(), 1000 * 10);
    return () => clearInterval(id);
  }, [hasDeploying]);

  return data;
};

export let customProviderDeploymentLoader = createLoader({
  name: 'customProviderDeployment',
  parents: [customProviderDeploymentsLoader],
  fetch: (i: {
    instanceId: string;
    customProviderId: string;
    customProviderDeploymentId: string;
  }) =>
    withAuth(sdk =>
      sdk.customProviders.deployments.get(i.instanceId, i.customProviderDeploymentId)
    ),
  mutators: {}
});

export let useCustomProviderDeployment = (
  instanceId: string | null | undefined,
  customProviderId: string | null | undefined,
  customProviderDeploymentId: string | null | undefined
) => {
  let data = customProviderDeploymentLoader.use(
    instanceId && customProviderDeploymentId && customProviderId
      ? { instanceId, customProviderId, customProviderDeploymentId }
      : null
  );

  let inProgressStatuses = ['deploying', 'queued'];
  let isInProgress = data.data?.status ? inProgressStatuses.includes(data.data.status) : false;

  let hasRunningSteps = (data.data as any)?.steps?.some(
    (s: any) => s.status === 'running' || s.status === 'queued'
  );

  let refetchRef = useRef(data.refetch);
  refetchRef.current = data.refetch;
  useEffect(() => {
    if (!isInProgress && !hasRunningSteps) return;
    let id = setInterval(() => refetchRef.current(), 1000);
    return () => clearInterval(id);
  }, [isInProgress, hasRunningSteps]);

  let prevInProgress = useRef(isInProgress);
  useEffect(() => {
    if (prevInProgress.current && !isInProgress && instanceId && customProviderId) {
      customProviderLoader.refetchAll();
    }
    prevInProgress.current = isInProgress;
  }, [isInProgress]);

  return data;
};

export let customProviderDeploymentLogsLoader = createLoader({
  name: 'customProviderDeploymentLogs',
  parents: [customProviderDeploymentLoader],
  fetch: (i: {
    instanceId: string;
    customProviderId: string;
    customProviderDeploymentId: string;
  }) =>
    withAuth(sdk =>
      sdk.customProviders.deployments.getLogs(i.instanceId, i.customProviderDeploymentId)
    ),
  mutators: {}
});

export let useCustomProviderDeploymentLogs = (
  instanceId: string | null | undefined,
  customProviderId: string | null | undefined,
  customProviderDeploymentId: string | null | undefined,
  deploymentStatus: string | null | undefined
) => {
  let data = customProviderDeploymentLogsLoader.use(
    instanceId && customProviderId && customProviderDeploymentId
      ? { instanceId, customProviderId, customProviderDeploymentId }
      : null
  );

  let hasRunningSteps = (data.data as any)?.steps?.some(
    (s: any) => s.status === 'running' || s.status === 'queued'
  );
  let isInProgress =
    deploymentStatus == 'deploying' || deploymentStatus == 'queued' || hasRunningSteps;

  let refetchRef = useRef(data.refetch);
  refetchRef.current = data.refetch;
  useEffect(() => {
    if (!isInProgress || !customProviderDeploymentId) return;
    let id = setInterval(() => refetchRef.current(), 1000 * 3);
    return () => clearInterval(id);
  }, [isInProgress, customProviderDeploymentId]);

  return data;
};
