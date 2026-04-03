import {
  DashboardInstancePortalsCreateBody,
  DashboardInstancePortalsListQuery,
  DashboardInstancePortalsUpdateBody
} from '@metorial/dashboard-sdk';
import { createLoader } from '@metorial/data-hooks';
import { usePaginator } from '../../lib/usePaginator';
import { withAuth } from '../../user';

export let portalsLoader = createLoader({
  name: 'portals',
  parents: [],
  fetch: (i: { instanceId: string } & DashboardInstancePortalsListQuery) =>
    withAuth(sdk => sdk.portals.list(i.instanceId, i)),
  mutators: {
    create: (body: DashboardInstancePortalsCreateBody, { input: { instanceId } }) =>
      withAuth(sdk => sdk.portals.create(instanceId, body))
  }
});

export let usePortals = (
  instanceId: string | null | undefined,
  query?: DashboardInstancePortalsListQuery
) => {
  let portals = usePaginator(
    pagination =>
      portalsLoader.use(instanceId ? { instanceId, ...pagination, ...query } : null),
    instanceId ?? null
  );

  return {
    ...portals,
    createMutator: portals.useMutator('create')
  };
};

export let useCreatePortal = portalsLoader.createExternalMutator(
  (i: DashboardInstancePortalsCreateBody & { instanceId: string }) =>
    withAuth(sdk => sdk.portals.create(i.instanceId, i))
);

export let portalLoader = createLoader({
  name: 'portal',
  parents: [portalsLoader],
  fetch: (i: { instanceId: string; portalId: string }) =>
    withAuth(sdk => sdk.portals.get(i.instanceId, i.portalId)),
  mutators: {
    update: (
      body: DashboardInstancePortalsUpdateBody,
      { input: { instanceId, portalId } }
    ) => withAuth(sdk => sdk.portals.update(instanceId, portalId, body)),
    delete: (_: void, { input: { instanceId, portalId } }) =>
      withAuth(sdk => sdk.portals.delete(instanceId, portalId))
  }
});

export let usePortal = (
  instanceId: string | null | undefined,
  portalId: string | null | undefined
) => {
  let portal = portalLoader.use(instanceId && portalId ? { instanceId, portalId } : null);

  return {
    ...portal,
    useUpdateMutator: portal.useMutator('update'),
    useDeleteMutator: portal.useMutator('delete')
  };
};
