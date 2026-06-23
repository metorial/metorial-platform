import { Fabric } from '@metorial/fabric';
import { createSubspaceService, toEventBase } from '../lib/subspaceService';
import { finalizeSubspaceSessionCreate } from './session';
import { subspace } from '../subspace';

export let subspaceIntegrationInstanceService = createSubspaceService(
  subspace.integrationInstance,
  ['get', 'list', 'create', 'update', 'delete', 'createSessionTemplate', 'createSession'],
  inner => ({
    create: async (...params: Parameters<typeof inner.create>) => {
      let eventBase = toEventBase(params[0]);
      await Fabric.fire('provider.integration_instance.created:before', eventBase);

      let integrationInstance = await inner.create(...params);

      await Fabric.fire('provider.integration_instance.created:after', {
        ...eventBase,
        integrationInstance
      });

      return integrationInstance;
    },
    delete: async (...params: Parameters<typeof inner.delete>) => {
      let eventBase = toEventBase(params[0]);
      await Fabric.fire('provider.integration_instance.deleted:before', eventBase);

      let integrationInstance = await inner.delete(...params);

      await Fabric.fire('provider.integration_instance.deleted:after', {
        ...eventBase,
        integrationInstance
      });

      return integrationInstance;
    },
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
