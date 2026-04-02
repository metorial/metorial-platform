import {
  DashboardInstancePortalsConsumerAccessCreateBody,
  DashboardInstancePortalsConsumerAccessListQuery
} from '@metorial/dashboard-sdk';
import { createLoader } from '@metorial/data-hooks';
import { usePaginator } from '../../lib/usePaginator';
import { withAuth } from '../../user';

export let portalConsumerAccessLoader = createLoader({
  name: 'portalConsumerAccess',
  parents: [],
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

export let useCreatePortalConsumerAccess = portalConsumerAccessLoader.createExternalMutator(
  (i: DashboardInstancePortalsConsumerAccessCreateBody & { instanceId: string; portalId: string }) =>
    withAuth(sdk => sdk.portals.consumerAccess.create(i.instanceId, i.portalId, i))
);

export let useDeletePortalConsumerAccess = portalConsumerAccessLoader.createExternalMutator(
  (i: { instanceId: string; portalId: string; consumerAccessId: string }) =>
    withAuth(sdk => sdk.portals.consumerAccess.delete(i.instanceId, i.portalId, i.consumerAccessId))
);
