import { resolveConsumerActorIds } from '../lib/resolveConsumerActors';
import { createSubspaceService } from '../lib/subspaceService';
import { subspace } from '../subspace';

export let subspaceProviderDeploymentService = createSubspaceService(
  subspace.providerDeployment,
  ['get', 'getMany', 'list', 'update', 'create', 'delete'],
  inner => ({
    list: async (
      arg0: Parameters<typeof inner.list>[0] & {
        consumerIds?: string[];
      }
    ) => {
      if (arg0.consumerIds) {
        let consumerActorIds = await resolveConsumerActorIds(arg0.consumerIds);

        arg0.actorIds = [...new Set([...(arg0.actorIds ?? []), ...consumerActorIds])];
      }

      return await inner.list(arg0);
    }
  })
);

export type SubspaceProviderDeployment = Awaited<
  ReturnType<typeof subspace.providerDeployment.get>
>;
