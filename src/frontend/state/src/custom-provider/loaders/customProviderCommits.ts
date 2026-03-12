import { DashboardInstanceCustomProvidersCommitsListQuery } from '@metorial/dashboard-sdk';
import { createLoader } from '@metorial/data-hooks';
import { useEffect, useRef } from 'react';
import { usePaginator } from '../../lib/usePaginator';
import { withAuth } from '../../user';
import { customProviderLoader } from './customProviders';

type CustomProviderCommitsQuery = Omit<
  DashboardInstanceCustomProvidersCommitsListQuery,
  'customProviderId'
>;

export let customProviderCommitsLoader = createLoader({
  name: 'customProviderCommits',
  parents: [],
  fetch: (
    i: {
      instanceId: string;
      customProviderId: string;
    } & CustomProviderCommitsQuery
  ) =>
    withAuth(sdk => {
      let { customProviderId, ...query } = i;
      return sdk.customProviders.commits.list(i.instanceId, {
        ...query,
        customProviderId
      });
    }),
  mutators: {}
});

export let useCustomProviderCommits = (
  instanceId: string | null | undefined,
  customProviderId: string | null | undefined,
  query?: CustomProviderCommitsQuery
) => {
  let data = usePaginator(pagination =>
    customProviderCommitsLoader.use(
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

export let customProviderCommitLoader = createLoader({
  name: 'customProviderCommit',
  parents: [customProviderCommitsLoader],
  fetch: (i: {
    instanceId: string;
    customProviderId: string;
    customProviderCommitId: string;
  }) =>
    withAuth(sdk => sdk.customProviders.commits.get(i.instanceId, i.customProviderCommitId)),
  mutators: {}
});

export let useCustomProviderCommit = (
  instanceId: string | null | undefined,
  customProviderId: string | null | undefined,
  customProviderCommitId: string | null | undefined
) => {
  let data = customProviderCommitLoader.use(
    instanceId && customProviderCommitId && customProviderId
      ? { instanceId, customProviderId, customProviderCommitId }
      : null
  );

  let inProgressStatuses = ['deploying', 'queued'];
  let isInProgress = data.data?.status ? inProgressStatuses.includes(data.data.status) : false;

  let hasRunningSteps = data.data?.steps?.some(
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
