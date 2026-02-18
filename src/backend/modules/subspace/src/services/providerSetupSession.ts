import { subspaceReferenceSetupSessionService } from '@metorial/module-subspace-reference';
import { createSubspaceService } from '../lib/subspaceService';
import { subspace } from '../subspace';

export let subspaceProviderSetupSessionService = createSubspaceService(
  subspace.providerSetupSession,
  ['get', 'list', 'create', 'update', 'delete'],
  inner => ({
    create: async (...params: Parameters<typeof inner.create>) => {
      let setupSession = await inner.create(...params);

      await subspaceReferenceSetupSessionService
        .create({
          instance: params[0].instance,
          setupSession: {
            id: setupSession.id,
            providerId: params[0].providerId,
            providerDeploymentId: setupSession.providerDeploymentId,
            providerAuthMethodId: params[0].providerAuthMethodId,
            name: setupSession.name,
            createdAt: setupSession.createdAt
          }
        })
        .catch(err => console.error('Failed to store subspace reference:', err));

      return setupSession;
    }
  })
);

export type SubspaceProviderSetupSession = Awaited<
  ReturnType<typeof subspace.providerSetupSession.get>
>;
