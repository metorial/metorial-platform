import {
  DashboardInstanceMagicMcpServersCreateBody,
  DashboardInstanceMagicMcpServersListQuery,
  DashboardInstanceMagicMcpServersUpdateBody
} from '@metorial/dashboard-sdk/src/gen/src/mt_2025_01_01_dashboard';
import { createLoader } from '@metorial/data-hooks';
import { usePaginator } from '../../lib/usePaginator';
import { withAuth } from '../../user';

export let magicMcpServersLoader = createLoader({
  name: 'magicMcpServers',
  parents: [],
  fetch: (i: { instanceId: string } & DashboardInstanceMagicMcpServersListQuery) =>
    withAuth(sdk => sdk.magicMcp.servers.list(i.instanceId, i)),
  mutators: {}
});

export let useCreateMagicMcpServer = magicMcpServersLoader.createExternalMutator(
  (i: DashboardInstanceMagicMcpServersCreateBody & { instanceId: string }) =>
    withAuth(sdk => sdk.magicMcp.servers.create(i.instanceId, i)),
  {
    disableToast: true
  }
);

export let useMagicMcpServers = (
  instanceId: string | null | undefined,
  query?: DashboardInstanceMagicMcpServersListQuery
) => {
  let data = usePaginator(pagination =>
    magicMcpServersLoader.use(instanceId ? { instanceId, ...pagination, ...query } : null)
  );

  return data;
};

export let magicMcpServerLoader = createLoader({
  name: 'magicMcpServer',
  parents: [magicMcpServersLoader],
  fetch: (i: { instanceId: string; magicMcpServerId: string }) =>
    withAuth(sdk => sdk.magicMcp.servers.get(i.instanceId, i.magicMcpServerId)),
  mutators: {
    update: (
      i: DashboardInstanceMagicMcpServersUpdateBody,
      { input: { instanceId, magicMcpServerId } }
    ) => withAuth(sdk => sdk.magicMcp.servers.update(instanceId, magicMcpServerId, i)),

    delete: (_, { input: { instanceId, magicMcpServerId } }) =>
      withAuth(sdk => sdk.magicMcp.servers.delete(instanceId, magicMcpServerId))
  }
});

export let useMagicMcpServer = (
  instanceId: string | null | undefined,
  magicMcpServerId: string | null | undefined
) => {
  let data = magicMcpServerLoader.use(
    instanceId && magicMcpServerId ? { instanceId, magicMcpServerId } : null
  );

  return {
    ...data,
    useUpdateMutator: data.useMutator('update'),
    useDeleteMutator: data.useMutator('delete')
  };
};
