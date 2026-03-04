import {
  DashboardInstanceCustomProvidersVersionsCreateBody,
  DashboardInstanceCustomProvidersVersionsListQuery
} from '@metorial/dashboard-sdk';
import { createLoader, useMutation } from '@metorial/data-hooks';
import { useEffect, useRef } from 'react';
import { usePaginator } from '../../lib/usePaginator';
import { withAuth } from '../../user';

type CustomProviderVersionsQuery = Omit<
  DashboardInstanceCustomProvidersVersionsListQuery,
  'customProviderId'
>;

export let customProviderVersionsLoader = createLoader({
  name: 'customProviderVersions',
  parents: [],
  fetch: (
    i: {
      instanceId: string;
      customProviderId: string;
    } & CustomProviderVersionsQuery
  ) =>
    withAuth(sdk =>
      sdk.customProviders.versions.list(i.instanceId, {
        ...i,
        customProviderId: i.customProviderId
      })
    ),
  mutators: {}
});

export let useCreateCustomProviderVersion = customProviderVersionsLoader.createExternalMutator(
  (
    i: DashboardInstanceCustomProvidersVersionsCreateBody & {
      instanceId: string;
      customProviderId: string;
    }
  ) =>
    withAuth(sdk =>
      sdk.customProviders.versions.create(i.instanceId, {
        ...i,
        customProviderId: i.customProviderId
      })
    )
);

export let useListProviderVersions = () =>
  useMutation(
    (
      i: DashboardInstanceCustomProvidersVersionsListQuery & {
        instanceId: string;
        customProviderId: string;
      }
    ) =>
      withAuth(sdk =>
        sdk.customProviders.versions.list(i.instanceId, {
          ...i,
          customProviderId: i.customProviderId
        })
      )
  );

export let useCustomProviderVersions = (
  instanceId: string | null | undefined,
  customProviderId: string | null | undefined,
  query?: CustomProviderVersionsQuery
) => {
  let data = usePaginator(pagination =>
    customProviderVersionsLoader.use(
      instanceId && customProviderId
        ? { instanceId, customProviderId, ...pagination, ...query }
        : null
    )
  );

  let inProgressStatuses = ['deploying', 'queued'];
  let hasInProgress = data.data?.items.some(
    (i: { status: string | null }) => i.status && inProgressStatuses.includes(i.status)
  );
  let refetchRef = useRef(data.refetch);
  refetchRef.current = data.refetch;
  useEffect(() => {
    if (!hasInProgress) return;
    let id = setInterval(() => refetchRef.current(), 1000 * 5);
    return () => clearInterval(id);
  }, [hasInProgress]);

  return data;
};

export let customProviderVersionLoader = createLoader({
  name: 'customProviderVersion',
  parents: [customProviderVersionsLoader],
  fetch: (i: {
    instanceId: string;
    customProviderId: string;
    customProviderVersionId: string;
  }) =>
    withAuth(sdk => sdk.customProviders.versions.get(i.instanceId, i.customProviderVersionId)),
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

export let useCustomProviderVersion = (
  instanceId: string | null | undefined,
  customProviderId: string | null | undefined,
  customProviderVersionId: string | null | undefined
) => {
  let data = customProviderVersionLoader.use(
    instanceId && customProviderVersionId && customProviderId
      ? { instanceId, customProviderId, customProviderVersionId }
      : null
  );

  let isDone = data.data?.status ? versionDoneStatuses.has(data.data.status) : false;
  let refetchRef = useRef(data.refetch);
  refetchRef.current = data.refetch;
  useEffect(() => {
    if (isDone || !data.data) return;
    let id = setInterval(() => refetchRef.current(), 1000 * 3);
    return () => clearInterval(id);
  }, [isDone, !!data.data]);

  return data;
};
