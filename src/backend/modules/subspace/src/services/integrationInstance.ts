import { createSubspaceService } from '../lib/subspaceService';
import { finalizeSubspaceSessionCreate } from './session';
import { subspace } from '../subspace';

export let subspaceIntegrationInstanceService = createSubspaceService(
  subspace.integrationInstance,
  ['get', 'list', 'create', 'update', 'delete', 'createSessionTemplate', 'createSession'],
  inner => ({
    createSession: async (...params: Parameters<typeof inner.createSession>) => {
      let session = await inner.createSession(...params);

      return await finalizeSubspaceSessionCreate({
        instance: params[0].instance,
        session
      });
    }
  })
);

export type SubspaceIntegrationInstance = Awaited<
  ReturnType<typeof subspace.integrationInstance.get>
>;
