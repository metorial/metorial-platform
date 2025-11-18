import {
  DashboardInstancePortalsConsumerGroupsCreateBody,
  DashboardInstancePortalsConsumerGroupsListQuery,
  DashboardInstancePortalsConsumerGroupsUpdateBody
} from '@metorial/dashboard-sdk/src/gen/src/mt_2025_01_01_dashboard';
import { createLoader } from '@metorial/data-hooks';
import { usePaginator } from '../../lib/usePaginator';
import { withAuth } from '../../user';

export let portalConsumerGroupsLoader = createLoader({
  name: 'portalConsumerGroups',
  parents: [],
  fetch: (
    i: {
      instanceId: string;
      portalId: string;
    } & DashboardInstancePortalsConsumerGroupsListQuery
  ) => withAuth(sdk => sdk.portals.consumerGroups.list(i.instanceId, i.portalId, i)),
  mutators: {
    create: (
      i: DashboardInstancePortalsConsumerGroupsCreateBody,
      { input: { instanceId, portalId } }
    ) => withAuth(sdk => sdk.portals.consumerGroups.create(instanceId, portalId, i)),

    delete: (i: { groupId: string }, { input: { instanceId, portalId } }) =>
      withAuth(sdk => sdk.portals.consumerGroups.delete(instanceId, portalId, i.groupId))
  }
});

export let useCreatePortalConsumerGroup = portalConsumerGroupsLoader.createExternalMutator(
  (
    i: DashboardInstancePortalsConsumerGroupsCreateBody & {
      instanceId: string;
      portalId: string;
    }
  ) => withAuth(sdk => sdk.portals.consumerGroups.create(i.instanceId, i.portalId, i))
);

export let usePortalConsumerGroups = (
  instanceId: string | null | undefined,
  portalId: string | null | undefined,
  query?: DashboardInstancePortalsConsumerGroupsListQuery
) => {
  let data = usePaginator(pagination =>
    portalConsumerGroupsLoader.use(
      instanceId && portalId ? { instanceId, portalId, ...pagination, ...query } : null
    )
  );

  return {
    ...data,
    createMutator: data.useMutator('create'),
    revokeMutator: data.useMutator('delete')
  };
};

export let portalGroupLoader = createLoader({
  name: 'portalGroup',
  parents: [portalConsumerGroupsLoader],
  fetch: (i: { instanceId: string; portalId: string; groupId: string }) =>
    withAuth(sdk => sdk.portals.consumerGroups.get(i.instanceId, i.portalId, i.groupId)),
  mutators: {
    delete: (_, { input: { instanceId, portalId, groupId } }) =>
      withAuth(sdk => sdk.portals.consumerGroups.delete(instanceId, portalId, groupId)),

    update: (
      i: DashboardInstancePortalsConsumerGroupsUpdateBody,
      { input: { instanceId, portalId, groupId } }
    ) => withAuth(sdk => sdk.portals.consumerGroups.update(instanceId, portalId, groupId, i))
  }
});

export let usePortalConsumerGroup = (
  instanceId: string | null | undefined,
  portalId: string | null | undefined,
  groupId: string | null | undefined
) => {
  let data = portalGroupLoader.use(
    instanceId && portalId && groupId ? { instanceId, portalId, groupId } : null
  );

  return {
    ...data,
    useDeleteMutator: data.useMutator('delete'),
    useUpdateMutator: data.useMutator('update')
  };
};
