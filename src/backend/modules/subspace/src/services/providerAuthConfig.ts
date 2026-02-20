import { Fabric } from '@metorial/fabric';
import { subspaceReferenceAuthConfigService } from '@metorial/module-subspace-reference';
import { createSubspaceService, toEventBase } from '../lib/subspaceService';
import { subspace } from '../subspace';

export let subspaceProviderAuthConfigService = createSubspaceService(
  subspace.providerAuthConfig,
  ['get', 'list', 'update', 'create'],
  inner => ({
    create: async (...params: Parameters<typeof inner.create>) => {
      let eventBase = toEventBase(params[0]);
      await Fabric.fire('provider.auth_config.created:before', eventBase);

      let authConfig = await inner.create(...params);

      await subspaceReferenceAuthConfigService
        .create({
          instance: params[0].instance,
          authConfig: {
            id: authConfig.id,
            providerId: authConfig.providerId,
            providerDeploymentId: null,
            providerAuthMethodId: authConfig.authMethod?.id ?? '',
            name: authConfig.name,
            isEphemeral: authConfig.isEphemeral,
            createdAt: authConfig.createdAt
          }
        })
        .catch(err => console.error('Failed to store subspace reference:', err));

      await Fabric.fire('provider.auth_config.created:after', { ...eventBase, authConfig });

      return authConfig;
    },
    update: async (...params: Parameters<typeof inner.update>) => {
      let eventBase = toEventBase(params[0]);
      await Fabric.fire('provider.auth_config.updated:before', eventBase);

      let authConfig = await inner.update(...params);

      await Fabric.fire('provider.auth_config.updated:after', { ...eventBase, authConfig });

      return authConfig;
    }
  })
);

export type SubspaceProviderAuthConfig = Awaited<
  ReturnType<typeof subspace.providerAuthConfig.get>
>;
