import { Fabric } from '@metorial/fabric';
import { subspaceReferenceAuthCredentialsService } from '@metorial/module-subspace-reference';
import { createSubspaceService, toEventBase } from '../lib/subspaceService';
import { subspace } from '../subspace';

export let subspaceProviderAuthCredentialsService = createSubspaceService(
  subspace.providerAuthCredentials,
  ['get', 'list', 'update', 'create'],
  inner => ({
    create: async (...params: Parameters<typeof inner.create>) => {
      let eventBase = toEventBase(params[0]);
      await Fabric.fire('provider.auth_credentials.created:before', eventBase);

      let authCredentials = await inner.create(...params);

      await subspaceReferenceAuthCredentialsService
        .create({
          instance: params[0].instance,
          authCredentials: {
            id: authCredentials.id,
            providerId: authCredentials.providerId,
            providerAuthMethodId: null,
            name: authCredentials.name,
            createdAt: authCredentials.createdAt
          }
        })
        .catch(err => console.error('Failed to store subspace reference:', err));

      await Fabric.fire('provider.auth_credentials.created:after', {
        ...eventBase,
        authCredentials
      });

      return authCredentials;
    },
    update: async (...params: Parameters<typeof inner.update>) => {
      let eventBase = toEventBase(params[0]);
      await Fabric.fire('provider.auth_credentials.updated:before', eventBase);

      let authCredentials = await inner.update(...params);

      await Fabric.fire('provider.auth_credentials.updated:after', {
        ...eventBase,
        authCredentials
      });

      return authCredentials;
    }
  })
);

export type SubspaceProviderAuthCredentials = Awaited<
  ReturnType<typeof subspace.providerAuthCredentials.get>
>;
