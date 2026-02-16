import {
  DashboardInstancePortalsCreateBody,
  DashboardInstancePortalsListQuery,
  DashboardInstancePortalsUpdateBody
} from '@metorial/dashboard-sdk/src/gen/src/mt_2026_02_01_dashboard';
import { createLoader } from '@metorial/data-hooks';
import { usePaginator } from '../../lib/usePaginator';
import { withAuth } from '../../user';

export let portalsLoader = createLoader({
  name: 'portals',
  parents: [],
  fetch: (i: { instanceId: string } & DashboardInstancePortalsListQuery) =>
    withAuth(sdk => sdk.portals.list(i.instanceId, i)),
  mutators: {
    update: (
      i: DashboardInstancePortalsUpdateBody & {
        portalId: string;
      },
      { input: { instanceId } }
    ) => withAuth(sdk => sdk.portals.update(instanceId, i.portalId, i)),

    delete: (i: { portalId: string }, { input: { instanceId } }) =>
      withAuth(sdk => sdk.portals.delete(instanceId, i.portalId))
  }
});

export let useCreatePortal = portalsLoader.createExternalMutator(
  (i: DashboardInstancePortalsCreateBody & { instanceId: string }) =>
    withAuth(sdk => sdk.portals.create(i.instanceId, i))
);

export let usePortals = (
  instanceId: string | null | undefined,
  query?: DashboardInstancePortalsListQuery
) => {
  let data = usePaginator(pagination =>
    portalsLoader.use(instanceId ? { instanceId, ...pagination, ...query } : null)
  );

  return {
    ...data,
    createMutator: useCreatePortal,
    revokeMutator: data.useMutator('delete'),
    updateMutator: data.useMutator('update')
  };
};

export let portalLoader = createLoader({
  name: 'portal',
  parents: [portalsLoader],
  fetch: (i: { instanceId: string; portalId: string }) =>
    withAuth(sdk => sdk.portals.get(i.instanceId, i.portalId)),
  mutators: {
    update: (i: DashboardInstancePortalsUpdateBody, { input: { instanceId, portalId } }) =>
      withAuth(sdk => sdk.portals.update(instanceId, portalId, i)),

    delete: (_, { input: { instanceId, portalId } }) =>
      withAuth(sdk => sdk.portals.delete(instanceId, portalId))
  }
});

export let usePortal = (
  instanceId: string | null | undefined,
  portalId: string | null | undefined
) => {
  let data = portalLoader.use(instanceId && portalId ? { instanceId, portalId } : null);

  return {
    ...data,
    useUpdateMutator: data.useMutator('update'),
    useDeleteMutator: data.useMutator('delete')
  };
};
