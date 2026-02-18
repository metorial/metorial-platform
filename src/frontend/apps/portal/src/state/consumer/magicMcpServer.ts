import {
  MagicMcpServersCreateBody,
  MagicMcpServersListQuery,
  MagicMcpServersUpdateBody
} from '@metorial/consumer-sdk/src/gen/src/mt_2025_01_01_dashboard';
import { createLoader } from '@metorial/data-hooks';
import { mutation } from '@metorial/state/src/lib/mutation';
import { usePaginator } from '../lib/usePaginator';
import { withSdk } from './client';

export let magicMcpServersLoader = createLoader({
  name: 'magicMcpServers',
  parents: [],
  fetch: (i: MagicMcpServersListQuery) => withSdk(sdk => sdk.magicMcp.servers.list(i)),
  mutators: {}
});

export let useCreateMagicMcpServer = magicMcpServersLoader.createExternalMutator(
  (i: MagicMcpServersCreateBody) => withSdk(sdk => sdk.magicMcp.servers.create(i)),
  {
    disableToast: true
  }
);

export let createMagicMcpServer = (i: MagicMcpServersCreateBody) =>
  mutation(() => withSdk(sdk => sdk.magicMcp.servers.create(i)));

export let updateMagicMcpServer = (
  i: MagicMcpServersUpdateBody & { magicMcpServerId: string }
) => mutation(() => withSdk(sdk => sdk.magicMcp.servers.update(i.magicMcpServerId, i)));

export let useMagicMcpServers = (query?: MagicMcpServersListQuery) => {
  let data = usePaginator(pagination =>
    magicMcpServersLoader.use({ ...pagination, ...query })
  );

  return data;
};

export let magicMcpServerLoader = createLoader({
  name: 'magicMcpServer',
  parents: [magicMcpServersLoader],
  fetch: (i: { magicMcpServerId: string }) =>
    withSdk(sdk => sdk.magicMcp.servers.get(i.magicMcpServerId)),
  mutators: {
    update: (i: MagicMcpServersUpdateBody, { input: { magicMcpServerId } }) =>
      withSdk(sdk => sdk.magicMcp.servers.update(magicMcpServerId, i)),
    delete: (_, { input: { magicMcpServerId } }) =>
      withSdk(sdk => sdk.magicMcp.servers.delete(magicMcpServerId))
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
