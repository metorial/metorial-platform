import {
  DashboardInstancePortalsConsumerGroupsCreateBody,
  DashboardInstancePortalsConsumerGroupsListQuery,
  DashboardInstancePortalsConsumerGroupsUpdateBody
} from '@metorial/dashboard-sdk';
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
      body: DashboardInstancePortalsConsumerGroupsCreateBody,
      { input: { instanceId, portalId } }
    ) => withAuth(sdk => sdk.portals.consumerGroups.create(instanceId, portalId, body))
  }
});

export let usePortalConsumerGroups = (
  instanceId: string | null | undefined,
  portalId: string | null | undefined,
  query?: DashboardInstancePortalsConsumerGroupsListQuery
) => {
  let resetKey = instanceId && portalId ? `${instanceId}:${portalId}` : null;
  let groups = usePaginator(
    pagination =>
      portalConsumerGroupsLoader.use(
        instanceId && portalId ? { instanceId, portalId, ...pagination, ...query } : null
      ),
    resetKey
  );

  return {
    ...groups,
    createMutator: groups.useMutator('create')
  };
};

export let useCreatePortalConsumerGroup = portalConsumerGroupsLoader.createExternalMutator(
  (i: DashboardInstancePortalsConsumerGroupsCreateBody & { instanceId: string; portalId: string }) =>
    withAuth(sdk => sdk.portals.consumerGroups.create(i.instanceId, i.portalId, i))
);

export let portalConsumerGroupLoader = createLoader({
  name: 'portalConsumerGroup',
  parents: [portalConsumerGroupsLoader],
  fetch: (i: { instanceId: string; portalId: string; consumerGroupId: string }) =>
    withAuth(sdk =>
      sdk.portals.consumerGroups.get(i.instanceId, i.portalId, i.consumerGroupId)
    ),
  mutators: {
    update: (
      body: DashboardInstancePortalsConsumerGroupsUpdateBody,
      { input: { instanceId, portalId, consumerGroupId } }
    ) =>
      withAuth(sdk =>
        sdk.portals.consumerGroups.update(instanceId, portalId, consumerGroupId, body)
      ),
    delete: (_: void, { input: { instanceId, portalId, consumerGroupId } }) =>
      withAuth(sdk => sdk.portals.consumerGroups.delete(instanceId, portalId, consumerGroupId))
  }
});

export let usePortalConsumerGroup = (
  instanceId: string | null | undefined,
  portalId: string | null | undefined,
  consumerGroupId: string | null | undefined
) => {
  let group = portalConsumerGroupLoader.use(
    instanceId && portalId && consumerGroupId
      ? { instanceId, portalId, consumerGroupId }
      : null
  );

  return {
    ...group,
    useUpdateMutator: group.useMutator('update'),
    useDeleteMutator: group.useMutator('delete')
  };
};
