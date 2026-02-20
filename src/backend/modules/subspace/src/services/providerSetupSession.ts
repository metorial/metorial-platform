import { Fabric } from '@metorial/fabric';
import { subspaceReferenceSetupSessionService } from '@metorial/module-subspace-reference';
import { createSubspaceService, toEventBase } from '../lib/subspaceService';
import { subspace } from '../subspace';

export let subspaceProviderSetupSessionService = createSubspaceService(
  subspace.providerSetupSession,
  ['get', 'list', 'create', 'update'],
  inner => ({
    create: async (...params: Parameters<typeof inner.create>) => {
      let eventBase = toEventBase(params[0]);
      await Fabric.fire('provider.setup_session.created:before', eventBase);

      let setupSession = await inner.create(...params);

      await subspaceReferenceSetupSessionService
        .create({
          instance: params[0].instance,
          setupSession: {
            id: setupSession.id,
            providerId: setupSession.providerId,
            providerDeploymentId: setupSession.deployment?.id ?? null,
            providerAuthMethodId: setupSession.authMethod?.id ?? '',
            name: setupSession.name,
            createdAt: setupSession.createdAt
          }
        })
        .catch(err => console.error('Failed to store subspace reference:', err));

      await Fabric.fire('provider.setup_session.created:after', { ...eventBase, setupSession });

      return setupSession;
    },
    update: async (...params: Parameters<typeof inner.update>) => {
      let eventBase = toEventBase(params[0]);
      await Fabric.fire('provider.setup_session.updated:before', eventBase);

      let setupSession = await inner.update(...params);

      await Fabric.fire('provider.setup_session.updated:after', { ...eventBase, setupSession });

      return setupSession;
    }
  })
);

export type SubspaceProviderSetupSession = Awaited<
  ReturnType<typeof subspace.providerSetupSession.get>
>;
