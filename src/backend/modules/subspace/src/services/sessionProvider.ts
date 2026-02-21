import { Fabric } from '@metorial/fabric';
import { createSubspaceService, toEventBase } from '../lib/subspaceService';
import { subspace } from '../subspace';

export let subspaceSessionProviderService = createSubspaceService(
  subspace.sessionProvider,
  ['get', 'list', 'create', 'update', 'delete'],
  inner => ({
    create: async (...params: Parameters<typeof inner.create>) => {
      let eventBase = toEventBase(params[0]);
      await Fabric.fire('provider.session.provider.created:before', eventBase);

      let sessionProvider = await inner.create(...params);

      await Fabric.fire('provider.session.provider.created:after', {
        ...eventBase,
        sessionProvider
      });

      return sessionProvider;
    },
    update: async (...params: Parameters<typeof inner.update>) => {
      let eventBase = toEventBase(params[0]);
      await Fabric.fire('provider.session.provider.updated:before', eventBase);

      let sessionProvider = await inner.update(...params);

      await Fabric.fire('provider.session.provider.updated:after', {
        ...eventBase,
        sessionProvider
      });

      return sessionProvider;
    },
    delete: async (...params: Parameters<typeof inner.delete>) => {
      let eventBase = toEventBase(params[0]);
      await Fabric.fire('provider.session.provider.deleted:before', eventBase);

      let sessionProvider = await inner.delete(...params);

      await Fabric.fire('provider.session.provider.deleted:after', {
        ...eventBase,
        sessionProvider
      });

      return sessionProvider;
    }
  })
);

export type SubspaceSessionProvider = Awaited<ReturnType<typeof subspace.sessionProvider.get>>;
