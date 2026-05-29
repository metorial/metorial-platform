import { notFoundError, ServiceError } from '@lowerdeck/error';
import { createSubspaceService } from '../lib/subspaceService';
import { subspace } from '../subspace';

export let subspaceNetworkService = createSubspaceService(
  subspace.network,
  ['get', 'list'],
  inner => ({
    get: async (
      input: Parameters<typeof inner.get>[0] & {
        networkId: string;
      }
    ) => {
      let paginator = await inner.list({
        ...input,
        ids: [input.networkId]
      });

      let list = await paginator.run({ limit: 1 });
      let network = list.items[0];

      if (!network) {
        throw new ServiceError(notFoundError('network'));
      }

      return network;
    }
  })
);

export type SubspaceNetwork = Awaited<
  ReturnType<(typeof subspaceNetworkService)['get']>
>;
