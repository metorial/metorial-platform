import { getSentry } from '@lowerdeck/sentry';
import { resolveConsumerActorIds } from '../lib/resolveConsumerActors';
import { createSubspaceService } from '../lib/subspaceService';
import { subspace } from '../subspace';

let Sentry = getSentry();

export let subspaceProviderConfigService = createSubspaceService(
  subspace.providerConfig,
  ['get', 'getMany', 'list', 'update', 'create', 'delete', 'getConfigSchema'],
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

export type SubspaceProviderConfig = Awaited<ReturnType<typeof subspace.providerConfig.get>>;

export type SubspaceProviderConfigSchema = Awaited<
  ReturnType<typeof subspace.providerConfig.getConfigSchema>
>;
