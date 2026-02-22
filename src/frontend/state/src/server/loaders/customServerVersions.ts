import {
  DashboardInstanceCustomProvidersVersionsCreateBody,
  DashboardInstanceCustomProvidersVersionsListQuery
} from '@metorial/dashboard-sdk';
import { createLoader, useMutation } from '@metorial/data-hooks';
import { useEffect, useRef } from 'react';
import { usePaginator } from '../../lib/usePaginator';
import { withAuth } from '../../user';

export let customServerVersionsLoader = createLoader({
  name: 'customServerVersions',
  parents: [],
  fetch: (
    i: {
      instanceId: string;
      customServerId: string;
    } & DashboardInstanceCustomProvidersVersionsListQuery
  ) =>
    withAuth(sdk =>
      sdk.customProviders.versions.list(i.instanceId, {
        ...i,
        customProviderId: i.customServerId
      })
    ),
  mutators: {}
});

export let useCreateCustomServerVersion = customServerVersionsLoader.createExternalMutator(
  (
    i: DashboardInstanceCustomProvidersVersionsCreateBody & {
      instanceId: string;
      customServerId: string;
    }
  ) =>
    withAuth(sdk =>
      sdk.customProviders.versions.create(i.instanceId, {
        ...i,
        customProviderId: i.customServerId
      })
    )
);

export let useListServerVersions = () =>
  useMutation(
    (
      i: DashboardInstanceCustomProvidersVersionsListQuery & {
        instanceId: string;
        customServerId: string;
      }
    ) =>
      withAuth(sdk =>
        sdk.customProviders.versions.list(i.instanceId, {
          ...i,
          customProviderId: i.customServerId
        })
      )
  );

export let useCustomServerVersions = (
  instanceId: string | null | undefined,
  customServerId: string | null | undefined,
  query?: DashboardInstanceCustomProvidersVersionsListQuery
) => {
  let data = usePaginator(pagination =>
    customServerVersionsLoader.use(
      instanceId && customServerId
        ? { instanceId, customServerId, ...pagination, ...query }
        : null
    )
  );

  let inProgressStatuses = ['deploying', 'queued'];
  let hasInProgress = data.data?.items.some(
    (i: { status: string | null }) => i.status && inProgressStatuses.includes(i.status)
  );
  let refetchRef1 = useRef(data.refetch);
  refetchRef1.current = data.refetch;
  useEffect(() => {
    if (!hasInProgress) return;
    let id = setInterval(() => refetchRef1.current(), 1000 * 5);
    return () => clearInterval(id);
  }, [hasInProgress]);

  return data;
};

export let customServerVersionLoader = createLoader({
  name: 'customServerVersion',
  parents: [customServerVersionsLoader],
  fetch: (i: { instanceId: string; customServerId: string; customServerVersionId: string }) =>
    withAuth(sdk => sdk.customProviders.versions.get(i.instanceId, i.customServerVersionId)),
  mutators: {}
});

let versionDoneStatuses = new Set([
  'current',
  'available',
  'deployment_succeeded',
  'succeeded',
  'failed',
  'deployment_failed'
]);

export let useCustomServerVersion = (
  instanceId: string | null | undefined,
  customServerId: string | null | undefined,
  customServerVersionId: string | null | undefined
) => {
  let data = customServerVersionLoader.use(
    instanceId && customServerVersionId && customServerId
      ? { instanceId, customServerId, customServerVersionId }
      : null
  );

  let isDone = data.data?.status ? versionDoneStatuses.has(data.data.status) : false;
  let refetchRef2 = useRef(data.refetch);
  refetchRef2.current = data.refetch;
  useEffect(() => {
    if (isDone || !data.data) return;
    let id = setInterval(() => refetchRef2.current(), 1000 * 3);
    return () => clearInterval(id);
  }, [isDone, !!data.data]);

  return {
    ...data
  };
};
