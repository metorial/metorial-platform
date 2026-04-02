import {
  DashboardInstancePortalsConsumerAccessCreateBody,
  DashboardInstancePortalsConsumerAccessListQuery
} from '@metorial/dashboard-sdk';
import { createLoader, useMutation } from '@metorial/data-hooks';
import { autoPaginate } from '../../lib/autoPaginate';
import { usePaginator } from '../../lib/usePaginator';
import { withAuth } from '../../user';

export let allPortalConsumerAccessLoader = createLoader({
  name: 'allPortalConsumerAccess',
  parents: [],
  fetch: (
    i: {
      instanceId: string;
      portalId: string;
    } & Omit<DashboardInstancePortalsConsumerAccessListQuery, 'after' | 'before' | 'cursor'>
  ) =>
    withAuth(sdk =>
      autoPaginate(cursor =>
        sdk.portals.consumerAccess.list(i.instanceId, i.portalId, {
          ...i,
          ...cursor,
          limit: i.limit ?? 100
        })
      )
    ),
  mutators: {}
});

export let useAllPortalConsumerAccess = (
  instanceId: string | null | undefined,
  portalId: string | null | undefined,
  query?: Omit<DashboardInstancePortalsConsumerAccessListQuery, 'after' | 'before' | 'cursor'>
) => {
  return allPortalConsumerAccessLoader.use(
    instanceId && portalId ? { instanceId, portalId, ...query } : null
  );
};

export let portalConsumerAccessLoader = createLoader({
  name: 'portalConsumerAccess',
  parents: [allPortalConsumerAccessLoader],
  fetch: (
    i: {
      instanceId: string;
      portalId: string;
    } & DashboardInstancePortalsConsumerAccessListQuery
  ) => withAuth(sdk => sdk.portals.consumerAccess.list(i.instanceId, i.portalId, i)),
  mutators: {
    create: (
      body: DashboardInstancePortalsConsumerAccessCreateBody,
      { input: { instanceId, portalId } }
    ) => withAuth(sdk => sdk.portals.consumerAccess.create(instanceId, portalId, body)),
    delete: (
      body: { consumerAccessId: string },
      { input: { instanceId, portalId } }
    ) => withAuth(sdk => sdk.portals.consumerAccess.delete(instanceId, portalId, body.consumerAccessId))
  }
});

export let usePortalConsumerAccess = (
  instanceId: string | null | undefined,
  portalId: string | null | undefined,
  query?: DashboardInstancePortalsConsumerAccessListQuery
) => {
  let resetKey = instanceId && portalId ? `${instanceId}:${portalId}` : null;
  let access = usePaginator(
    pagination =>
      portalConsumerAccessLoader.use(
        instanceId && portalId ? { instanceId, portalId, ...pagination, ...query } : null
      ),
    resetKey
  );

  return {
    ...access,
    createMutator: access.useMutator('create'),
    deleteMutator: access.useMutator('delete')
  };
};

let refetchPortalConsumerAccessLoaders = () => {
  portalConsumerAccessLoader.refetchAll();
  allPortalConsumerAccessLoader.refetchAll();
};

export let useCreatePortalConsumerAccess = () =>
  useMutation(
    (i: DashboardInstancePortalsConsumerAccessCreateBody & { instanceId: string; portalId: string }) =>
      withAuth(sdk => sdk.portals.consumerAccess.create(i.instanceId, i.portalId, i)),
    {
      onSuccess: refetchPortalConsumerAccessLoaders
    }
  );

export let useCreatePortalConsumerAccessQuiet = () =>
  useMutation(
    (i: DashboardInstancePortalsConsumerAccessCreateBody & { instanceId: string; portalId: string }) =>
      withAuth(sdk => sdk.portals.consumerAccess.create(i.instanceId, i.portalId, i)),
    {
      onSuccess: refetchPortalConsumerAccessLoaders,
      disableToast: true
    }
  );

export let useDeletePortalConsumerAccess = () =>
  useMutation(
    (i: { instanceId: string; portalId: string; consumerAccessId: string }) =>
      withAuth(sdk => sdk.portals.consumerAccess.delete(i.instanceId, i.portalId, i.consumerAccessId)),
    {
      onSuccess: refetchPortalConsumerAccessLoaders
    }
  );
