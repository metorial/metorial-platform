import { createSubspaceService } from '../lib/subspaceService';
import { finalizeSubspaceSessionCreate } from './session';
import { subspace } from '../subspace';

export let subspaceIntegrationInstanceGroupService = createSubspaceService(
  subspace.integrationInstanceGroup,
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

export type SubspaceIntegrationInstanceGroup = Awaited<
  ReturnType<typeof subspace.integrationInstanceGroup.get>
>;
