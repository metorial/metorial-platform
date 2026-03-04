import {
  DashboardInstanceCustomProvidersCreateBody,
  DashboardInstanceCustomProvidersListQuery,
  DashboardInstanceCustomProvidersUpdateBody
} from '@metorial/dashboard-sdk';
import { createLoader } from '@metorial/data-hooks';
import { useEffect, useRef } from 'react';
import { usePaginator } from '../../lib/usePaginator';
import { withAuth } from '../../user';

let customProviderDoneStatuses = new Set(['active', 'archived']);

let toArrayIfString = <T extends string>(value: T | T[] | undefined) =>
  typeof value === 'string' ? [value] : value;

let normalizeCustomProvidersListQuery = (
  query: DashboardInstanceCustomProvidersListQuery
): DashboardInstanceCustomProvidersListQuery => ({
  ...query,
  status: toArrayIfString(query.status),
  type: toArrayIfString(query.type)
});

export let customProvidersLoader = createLoader({
  name: 'customProviders',
  parents: [],
  fetch: (i: { instanceId: string } & DashboardInstanceCustomProvidersListQuery) =>
    withAuth(sdk =>
      sdk.customProviders.list(i.instanceId, normalizeCustomProvidersListQuery(i))
    ),
  mutators: {}
});

export let useCreateCustomProvider = customProvidersLoader.createExternalMutator(
  (i: DashboardInstanceCustomProvidersCreateBody & { instanceId: string }) =>
    withAuth(sdk => sdk.customProviders.create(i.instanceId, i))
);

export let useCustomProviders = (
  instanceId: string | null | undefined,
  query?: DashboardInstanceCustomProvidersListQuery
) => {
  let data = usePaginator(pagination =>
    customProvidersLoader.use(instanceId ? { instanceId, ...pagination, ...query } : null)
  );

  return data;
};

export let customProviderLoader = createLoader({
  name: 'customProvider',
  parents: [customProvidersLoader],
  fetch: (i: { instanceId: string; customProviderId: string }) =>
    withAuth(sdk => sdk.customProviders.get(i.instanceId, i.customProviderId)),
  mutators: {
    update: (
      i: DashboardInstanceCustomProvidersUpdateBody,
      {
        input: { instanceId, customProviderId }
      }: { input: { instanceId: string; customProviderId: string } }
    ) => withAuth(sdk => sdk.customProviders.update(instanceId, customProviderId, i))
  }
});

export let useCustomProvider = (
  instanceId: string | null | undefined,
  customProviderId: string | null | undefined
) => {
  let data = customProviderLoader.use(
    instanceId && customProviderId ? { instanceId, customProviderId } : null
  );

  let isDone = data.data?.status ? customProviderDoneStatuses.has(data.data.status) : true;
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
