import {
  DashboardInstanceMagicMcpGroupsCreateBody,
  DashboardInstanceMagicMcpGroupsListQuery,
  DashboardInstanceMagicMcpGroupsUpdateBody
} from '@metorial/dashboard-sdk';
import { createLoader } from '@metorial/data-hooks';
import { usePaginator } from '../../lib/usePaginator';
import { withAuth } from '../../user';

export let magicMcpGroupsLoader = createLoader({
  name: 'magicMcpGroups',
  parents: [],
  fetch: (i: { instanceId: string } & DashboardInstanceMagicMcpGroupsListQuery) =>
    withAuth(sdk => sdk.magicMcp.groups.list(i.instanceId, i)),
  mutators: {
    update: (
      i: DashboardInstanceMagicMcpGroupsUpdateBody & {
        magicMcpGroupId: string;
      },
      { input: { instanceId } }
    ) => withAuth(sdk => sdk.magicMcp.groups.update(instanceId, i.magicMcpGroupId, i)),

    delete: (i: { magicMcpGroupId: string }, { input: { instanceId } }) =>
      withAuth(sdk => sdk.magicMcp.groups.delete(instanceId, i.magicMcpGroupId))
  }
});

export let useCreateMagicMcpGroup = magicMcpGroupsLoader.createExternalMutator(
  (i: DashboardInstanceMagicMcpGroupsCreateBody & { instanceId: string }) =>
    withAuth(sdk => sdk.magicMcp.groups.create(i.instanceId, i)),
  {
    disableToast: true
  }
);

export let useMagicMcpGroups = (
  instanceId: string | null | undefined,
  query?: DashboardInstanceMagicMcpGroupsListQuery
) => {
  let data = usePaginator(pagination =>
    magicMcpGroupsLoader.use(instanceId ? { instanceId, ...pagination, ...query } : null)
  );

  return {
    ...data,
    createMutator: useCreateMagicMcpGroup,
    revokeMutator: data.useMutator('delete'),
    updateMutator: data.useMutator('update')
  };
};

export let magicMcpGroupLoader = createLoader({
  name: 'magicMcpGroup',
  parents: [magicMcpGroupsLoader],
  fetch: (i: { instanceId: string; magicMcpGroupId: string }) =>
    withAuth(sdk => sdk.magicMcp.groups.get(i.instanceId, i.magicMcpGroupId)),
  mutators: {
    update: (
      i: DashboardInstanceMagicMcpGroupsUpdateBody,
      { input: { instanceId, magicMcpGroupId } }
    ) => withAuth(sdk => sdk.magicMcp.groups.update(instanceId, magicMcpGroupId, i)),

    delete: (_, { input: { instanceId, magicMcpGroupId } }) =>
      withAuth(sdk => sdk.magicMcp.groups.delete(instanceId, magicMcpGroupId)),

    addServers: (
      i: { magicMcpServerIds: string[] },
      { input: { instanceId, magicMcpGroupId } }
    ) =>
      withAuth(sdk =>
        sdk.magicMcp.groups.addServers(instanceId, magicMcpGroupId, {
          magicMcpServerIds: i.magicMcpServerIds
        })
      ),

    removeServers: (
      i: { magicMcpServerIds: string[] },
      { input: { instanceId, magicMcpGroupId } }
    ) =>
      withAuth(sdk =>
        sdk.magicMcp.groups.removeServers(instanceId, magicMcpGroupId, {
          magicMcpServerIds: i.magicMcpServerIds
        })
      )
  }
});

export let useMagicMcpGroup = (
  instanceId: string | null | undefined,
  magicMcpGroupId: string | null | undefined
) => {
  let data = magicMcpGroupLoader.use(
    instanceId && magicMcpGroupId ? { instanceId, magicMcpGroupId } : null
  );

  return {
    ...data,
    useUpdateMutator: data.useMutator('update'),
    useDeleteMutator: data.useMutator('delete'),
    useAddServersMutator: data.useMutator('addServers'),
    useRemoveServersMutator: data.useMutator('removeServers')
  };
};
