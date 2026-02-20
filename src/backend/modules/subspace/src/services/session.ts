import { Fabric } from '@metorial/fabric';
import { createSubspaceService, toEventBase } from '../lib/subspaceService';
import { subspace } from '../subspace';

export let subspaceSessionService = createSubspaceService(
  subspace.session,
  ['get', 'list', 'create', 'update'],
  inner => ({
    create: async (...params: Parameters<typeof inner.create>) => {
      let eventBase = toEventBase(params[0]);
      await Fabric.fire('provider.session.created:before', eventBase);

      let session = await inner.create(...params);

      await Fabric.fire('provider.session.created:after', { ...eventBase, session });

      return session;
    },
    update: async (...params: Parameters<typeof inner.update>) => {
      let eventBase = toEventBase(params[0]);
      await Fabric.fire('provider.session.updated:before', eventBase);

      let session = await inner.update(...params);

      await Fabric.fire('provider.session.updated:after', { ...eventBase, session });

      return session;
    }
  })
);

export type SubspaceSession = Awaited<ReturnType<typeof subspace.session.get>>;
