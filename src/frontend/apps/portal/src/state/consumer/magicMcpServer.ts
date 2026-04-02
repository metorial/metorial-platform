import { createLoader } from '@metorial/data-hooks';
import { usePaginator } from '../lib/usePaginator';
import { type PortalConsumerClient, withSdk } from './client';

export type PortalMagicMcpClient = PortalConsumerClient;

export type MagicMcpServersListQuery = NonNullable<
  Parameters<PortalMagicMcpClient['magicMcp']['servers']['list']>[0]
>;
export type MagicMcpServersCreateBody =
  Parameters<PortalMagicMcpClient['magicMcp']['servers']['create']>[0];
export type MagicMcpServersUpdateBody =
  Parameters<PortalMagicMcpClient['magicMcp']['servers']['update']>[1];
export type MagicMcpServersGetOutput = Awaited<
  ReturnType<PortalMagicMcpClient['magicMcp']['servers']['get']>
>;
export type MagicMcpServersListOutput = Awaited<
  ReturnType<PortalMagicMcpClient['magicMcp']['servers']['list']>
>;

export let withMagicMcpClient = withSdk;

export let magicMcpServersLoader = createLoader({
  name: 'magicMcpServers',
  parents: [],
  fetch: (input: MagicMcpServersListQuery) =>
    withMagicMcpClient(client => client.magicMcp.servers.list(input)),
  mutators: {}
});

export let useCreateMagicMcpServer = magicMcpServersLoader.createExternalMutator(
  (input: MagicMcpServersCreateBody) =>
    withMagicMcpClient(client => client.magicMcp.servers.create(input)),
  {
    disableToast: true
  }
);

export let useMagicMcpServers = (query?: MagicMcpServersListQuery) => {
  return usePaginator(pagination => magicMcpServersLoader.use({ ...pagination, ...query }));
};

export let magicMcpServerLoader = createLoader({
  name: 'magicMcpServer',
  parents: [magicMcpServersLoader],
  fetch: (input: { magicMcpServerId: string }) =>
    withMagicMcpClient(client => client.magicMcp.servers.get(input.magicMcpServerId)),
  mutators: {
    update: (input: MagicMcpServersUpdateBody, { input: loaderInput }) =>
      withMagicMcpClient(client =>
        client.magicMcp.servers.update(loaderInput.magicMcpServerId, input)
      ),
    delete: (_, { input: loaderInput }) =>
      withMagicMcpClient(client => client.magicMcp.servers.delete(loaderInput.magicMcpServerId))
  }
});

export let useMagicMcpServer = (magicMcpServerId: string | null | undefined) => {
  let data = magicMcpServerLoader.use(magicMcpServerId ? { magicMcpServerId } : null);

  return {
    ...data,
    useUpdateMutator: data.useMutator('update'),
    useDeleteMutator: data.useMutator('delete')
  };
};
