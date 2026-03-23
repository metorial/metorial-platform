import { Fabric } from '@metorial/fabric';
import { createSubspaceService, toEventBase } from '../lib/subspaceService';
import { subspace } from '../subspace';

export type SubspaceProviderAuthCredentials = Awaited<
  ReturnType<typeof subspace.providerAuthCredentials.get>
>;

export let subspaceProviderAuthCredentialsService = createSubspaceService(
  subspace.providerAuthCredentials,
  ['get', 'list', 'update', 'create'],
  inner => ({
    create: async (...params: Parameters<typeof inner.create>) => {
      let eventBase = toEventBase(params[0]);
      await Fabric.fire('provider.auth_credentials.created:before', eventBase);

      let authCredentials = await inner.create(...params);

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
