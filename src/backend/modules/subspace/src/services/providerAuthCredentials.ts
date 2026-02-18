import { subspaceReferenceAuthCredentialsService } from '@metorial/module-subspace-reference';
import { createSubspaceService } from '../lib/subspaceService';
import { subspace } from '../subspace';

export let subspaceProviderAuthCredentialsService = createSubspaceService(
  subspace.providerAuthCredentials,
  ['get', 'list', 'update', 'create'],
  inner => ({
    create: async (...params: Parameters<typeof inner.create>) => {
      let authCredentials = await inner.create(...params);

      await subspaceReferenceAuthCredentialsService
        .create({
          instance: params[0].instance,
          authCredentials: {
            id: authCredentials.id,
            providerId: params[0].providerId,
            providerAuthMethodId: null,
            name: authCredentials.name,
            createdAt: authCredentials.createdAt
          }
        })
        .catch(err => console.error('Failed to store subspace reference:', err));

      return authCredentials;
    }
  })
);

export type SubspaceProviderAuthCredentials = Awaited<
  ReturnType<typeof subspace.providerAuthCredentials.get>
>;
