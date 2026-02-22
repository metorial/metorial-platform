import {
  DashboardInstanceCustomProvidersCreateBody,
  DashboardInstanceCustomProvidersListQuery,
  DashboardInstanceCustomProvidersUpdateBody
} from '@metorial/dashboard-sdk';
import { createLoader } from '@metorial/data-hooks';
import { useEffect, useRef } from 'react';
import { usePaginator } from '../../lib/usePaginator';
import { withAuth } from '../../user';

let customServerDoneStatuses = new Set(['active', 'archived']);

let toArrayIfString = <T extends string>(value: T | T[] | undefined) =>
  typeof value === 'string' ? [value] : value;

let normalizeCustomServersListQuery = (
  query: DashboardInstanceCustomProvidersListQuery
): DashboardInstanceCustomProvidersListQuery => ({
  ...query,
  status: toArrayIfString(query.status),
  type: toArrayIfString(query.type)
});

export let customServersLoader = createLoader({
  name: 'customServers',
  parents: [],
  fetch: (i: { instanceId: string } & DashboardInstanceCustomProvidersListQuery) =>
    withAuth(sdk => sdk.customProviders.list(i.instanceId, normalizeCustomServersListQuery(i))),
  mutators: {}
});

export let useCreateCustomServer = customServersLoader.createExternalMutator(
  (i: DashboardInstanceCustomProvidersCreateBody & { instanceId: string }) =>
    withAuth(sdk => sdk.customProviders.create(i.instanceId, i))
);

export let useCustomServers = (
  instanceId: string | null | undefined,
  query?: DashboardInstanceCustomProvidersListQuery
) => {
  let data = usePaginator(pagination =>
    customServersLoader.use(instanceId ? { instanceId, ...pagination, ...query } : null)
  );

  return data;
};

export let customServerLoader = createLoader({
  name: 'customServer',
  parents: [customServersLoader],
  fetch: (i: { instanceId: string; customServerId: string }) =>
    withAuth(sdk => sdk.customProviders.get(i.instanceId, i.customServerId)),
  mutators: {
    update: (
      i: DashboardInstanceCustomProvidersUpdateBody,
      {
        input: { instanceId, customServerId }
      }: { input: { instanceId: string; customServerId: string } }
    ) => withAuth(sdk => sdk.customProviders.update(instanceId, customServerId, i))
  }
});

export let useCustomServer = (
  instanceId: string | null | undefined,
  customServerId: string | null | undefined
) => {
  let data = customServerLoader.use(
    instanceId && customServerId ? { instanceId, customServerId } : null
  );

  let isDone = data.data?.status ? customServerDoneStatuses.has(data.data.status) : true;
  let hasProvider = !!data.data?.provider?.id;
  let refetchRef = useRef(data.refetch);
  refetchRef.current = data.refetch;
  useEffect(() => {
    if ((isDone && hasProvider) || !data.data) return;
    let id = setInterval(() => refetchRef.current(), 1000 * 5);
    return () => clearInterval(id);
  }, [isDone, hasProvider, !!data.data]);

  return {
    ...data,
    useUpdateMutator: data.useMutator('update')
  };
};
