import {
  DashboardInstancePortalsConsumerAccessCreateBody,
  DashboardInstancePortalsConsumerAccessListQuery
} from '@metorial/dashboard-sdk/src/gen/src/mt_2025_01_01_dashboard';
import { createLoader } from '@metorial/data-hooks';
import { usePaginator } from '../../lib/usePaginator';
import { withAuth } from '../../user';

export let portalAccessesLoader = createLoader({
  name: 'portalAccesses',
  parents: [],
  fetch: (
    i: {
      instanceId: string;
      portalId: string;
    } & DashboardInstancePortalsConsumerAccessListQuery
  ) => withAuth(sdk => sdk.portals.consumerAccess.list(i.instanceId, i.portalId, i)),
  mutators: {
    create: (
      i: DashboardInstancePortalsConsumerAccessCreateBody,
      { input: { instanceId, portalId } }
    ) => withAuth(sdk => sdk.portals.consumerAccess.create(instanceId, portalId, i)),

    delete: (i: { accessId: string }, { input: { instanceId, portalId } }) =>
      withAuth(sdk => sdk.portals.consumerAccess.delete(instanceId, portalId, i.accessId))
  }
});

export let useCreatePortalAccess = portalAccessesLoader.createExternalMutator(
  (
    i: DashboardInstancePortalsConsumerAccessCreateBody & {
      instanceId: string;
      portalId: string;
    }
  ) => withAuth(sdk => sdk.portals.consumerAccess.create(i.instanceId, i.portalId, i))
);

export let usePortalAccesses = (
  instanceId: string | null | undefined,
  portalId: string | null | undefined,
  query?: DashboardInstancePortalsConsumerAccessListQuery
) => {
  let data = usePaginator(pagination =>
    portalAccessesLoader.use(
      instanceId && portalId ? { instanceId, portalId, ...pagination, ...query } : null
    )
  );

  return {
    ...data,
    createMutator: data.useMutator('create'),
    deleteMutator: data.useMutator('delete')
  };
};

export let portalAccessLoader = createLoader({
  name: 'portalAccess',
  parents: [portalAccessesLoader],
  fetch: (i: { instanceId: string; portalId: string; accessId: string }) =>
    withAuth(sdk => sdk.portals.consumerAccess.get(i.instanceId, i.portalId, i.accessId)),
  mutators: {
    delete: (_, { input: { instanceId, portalId, accessId } }) =>
      withAuth(sdk => sdk.portals.consumerAccess.delete(instanceId, portalId, accessId))
  }
});

export let usePortalAccess = (
  instanceId: string | null | undefined,
  portalId: string | null | undefined,
  accessId: string | null | undefined
) => {
  let data = portalAccessLoader.use(
    instanceId && portalId && accessId ? { instanceId, portalId, accessId } : null
  );

  return {
    ...data,
    useDeleteMutator: data.useMutator('delete')
  };
};
