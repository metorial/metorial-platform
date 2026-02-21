import { Fabric } from '@metorial/fabric';
import { createSubspaceService, toEventBase } from '../lib/subspaceService';
import { subspace } from '../subspace';

export let subspaceSessionTemplateProviderService = createSubspaceService(
  subspace.sessionTemplateProvider,
  ['get', 'list', 'create', 'update', 'delete'],
  inner => ({
    create: async (...params: Parameters<typeof inner.create>) => {
      let eventBase = toEventBase(params[0]);
      await Fabric.fire('provider.session_template.provider.created:before', eventBase);

      let sessionTemplateProvider = await inner.create(...params);

      await Fabric.fire('provider.session_template.provider.created:after', {
        ...eventBase,
        sessionTemplateProvider
      });

      return sessionTemplateProvider;
    },
    update: async (...params: Parameters<typeof inner.update>) => {
      let eventBase = toEventBase(params[0]);
      await Fabric.fire('provider.session_template.provider.updated:before', eventBase);

      let sessionTemplateProvider = await inner.update(...params);

      await Fabric.fire('provider.session_template.provider.updated:after', {
        ...eventBase,
        sessionTemplateProvider
      });

      return sessionTemplateProvider;
    },
    delete: async (...params: Parameters<typeof inner.delete>) => {
      let eventBase = toEventBase(params[0]);
      await Fabric.fire('provider.session_template.provider.deleted:before', eventBase);

      let sessionTemplateProvider = await inner.delete(...params);

      await Fabric.fire('provider.session_template.provider.deleted:after', {
        ...eventBase,
        sessionTemplateProvider
      });

      return sessionTemplateProvider;
    }
  })
);

export type SubspaceSessionTemplateProvider = Awaited<
  ReturnType<typeof subspace.sessionTemplateProvider.get>
>;
