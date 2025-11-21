import {
  // ConsumerMagicMcpServersCreateBody,
  ConsumerMagicMcpServersListQuery
} from '@metorial/consumer-sdk/src/gen/src/mt_2025_01_01_pulsar';
import { createLoader } from '@metorial/data-hooks';
import { usePaginator } from '../lib/usePaginator';
import { withSdk } from './client';

export let magicMcpServersLoader = createLoader({
  name: 'magicMcpServers',
  parents: [],
  fetch: (i: ConsumerMagicMcpServersListQuery) => withSdk(sdk => sdk.magicMcp.servers.list(i)),
  mutators: {}
});

// export let useCreateMagicMcpServer = magicMcpServersLoader.createExternalMutator(
//   (i: ConsumerMagicMcpServersCreateBody) =>
//     withSdk(sdk => sdk.magicMcp.servers.create(i)),
//   {
//     disableToast: true
//   }
// );

export let useMagicMcpServers = (query?: ConsumerMagicMcpServersListQuery) => {
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
    // update: (
    //   i: ConsumerMagicMcpServersUpdateBody,
    //   { input: { instanceId, magicMcpServerId } }
    // ) => withSdk(sdk => sdk.magicMcp.servers.update(instanceId, magicMcpServerId, i)),
    // delete: (_, { input: { instanceId, magicMcpServerId } }) =>
    //   withSdk(sdk => sdk.magicMcp.servers.delete(instanceId, magicMcpServerId))
  }
});

export let useMagicMcpServer = (magicMcpServerId: string | null | undefined) => {
  let data = magicMcpServerLoader.use(magicMcpServerId ? { magicMcpServerId } : null);

  return {
    ...data
    // useUpdateMutator: data.useMutator('update'),
    // useDeleteMutator: data.useMutator('delete')
  };
};
