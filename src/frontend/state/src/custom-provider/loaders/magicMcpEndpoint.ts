import {
  DashboardInstanceMagicMcpEndpointsAddServersBody,
  DashboardInstanceMagicMcpEndpointsCreateBody,
  DashboardInstanceMagicMcpEndpointsListQuery,
  DashboardInstanceMagicMcpEndpointsRemoveServersBody,
  DashboardInstanceMagicMcpEndpointsUpdateBody
} from '@metorial/dashboard-sdk';
import { createLoader } from '@metorial/data-hooks';
import { usePaginator } from '../../lib/usePaginator';
import { withAuth } from '../../user';

export let magicMcpEndpointsLoader = createLoader({
  name: 'magicMcpEndpoints',
  parents: [],
  fetch: (i: { instanceId: string } & DashboardInstanceMagicMcpEndpointsListQuery) =>
    withAuth(sdk => sdk.magicMcp.endpoints.list(i.instanceId, i)),
  mutators: {
    update: (
      i: DashboardInstanceMagicMcpEndpointsUpdateBody & {
        magicMcpEndpointId: string;
      },
      { input: { instanceId } }
    ) => withAuth(sdk => sdk.magicMcp.endpoints.update(instanceId, i.magicMcpEndpointId, i)),

    delete: (i: { magicMcpEndpointId: string }, { input: { instanceId } }) =>
      withAuth(sdk => sdk.magicMcp.endpoints.delete(instanceId, i.magicMcpEndpointId)),

    addServers: (
      i: DashboardInstanceMagicMcpEndpointsAddServersBody & {
        magicMcpEndpointId: string;
      },
      { input: { instanceId } }
    ) =>
      withAuth(sdk =>
        sdk.magicMcp.endpoints.addServers(instanceId, i.magicMcpEndpointId, {
          magicMcpServers: i.magicMcpServers
        })
      ),

    removeServers: (
      i: DashboardInstanceMagicMcpEndpointsRemoveServersBody & {
        magicMcpEndpointId: string;
      },
      { input: { instanceId } }
    ) =>
      withAuth(sdk =>
        sdk.magicMcp.endpoints.removeServers(instanceId, i.magicMcpEndpointId, {
          magicMcpServerIds: i.magicMcpServerIds
        })
      )
  }
});

export let createMagicMcpEndpoint = (
  i: DashboardInstanceMagicMcpEndpointsCreateBody & { instanceId: string }
) => withAuth(sdk => sdk.magicMcp.endpoints.create(i.instanceId, i));

export let useCreateMagicMcpEndpoint = magicMcpEndpointsLoader.createExternalMutator(
  createMagicMcpEndpoint,
  {
    disableToast: true
  }
);

export let useMagicMcpEndpoints = (
  instanceId: string | null | undefined,
  query?: DashboardInstanceMagicMcpEndpointsListQuery
) => {
  let data = usePaginator(pagination =>
    magicMcpEndpointsLoader.use(instanceId ? { instanceId, ...pagination, ...query } : null)
  );

  return {
    ...data,
    createMutator: useCreateMagicMcpEndpoint,
    updateMutator: data.useMutator('update'),
    deleteMutator: data.useMutator('delete'),
    addServersMutator: data.useMutator('addServers'),
    removeServersMutator: data.useMutator('removeServers')
  };
};

export let magicMcpEndpointLoader = createLoader({
  name: 'magicMcpEndpoint',
  parents: [magicMcpEndpointsLoader],
  fetch: (i: { instanceId: string; magicMcpEndpointId: string }) =>
    withAuth(sdk => sdk.magicMcp.endpoints.get(i.instanceId, i.magicMcpEndpointId)),
  mutators: {
    update: (
      i: DashboardInstanceMagicMcpEndpointsUpdateBody,
      { input: { instanceId, magicMcpEndpointId } }
    ) => withAuth(sdk => sdk.magicMcp.endpoints.update(instanceId, magicMcpEndpointId, i)),

    delete: (_, { input: { instanceId, magicMcpEndpointId } }) =>
      withAuth(sdk => sdk.magicMcp.endpoints.delete(instanceId, magicMcpEndpointId)),

    addServers: (
      i: DashboardInstanceMagicMcpEndpointsAddServersBody,
      { input: { instanceId, magicMcpEndpointId } }
    ) => withAuth(sdk => sdk.magicMcp.endpoints.addServers(instanceId, magicMcpEndpointId, i)),

    removeServers: (
      i: DashboardInstanceMagicMcpEndpointsRemoveServersBody,
      { input: { instanceId, magicMcpEndpointId } }
    ) =>
      withAuth(sdk => sdk.magicMcp.endpoints.removeServers(instanceId, magicMcpEndpointId, i))
  }
});

export let useMagicMcpEndpoint = (
  instanceId: string | null | undefined,
  magicMcpEndpointId: string | null | undefined
) => {
  let data = magicMcpEndpointLoader.use(
    instanceId && magicMcpEndpointId ? { instanceId, magicMcpEndpointId } : null
  );

  return {
    ...data,
    useUpdateMutator: data.useMutator('update'),
    useDeleteMutator: data.useMutator('delete'),
    useAddServersMutator: data.useMutator('addServers'),
    useRemoveServersMutator: data.useMutator('removeServers')
  };
};
