import { Fabric } from '@metorial/fabric';
import { createSubspaceService, toEventBase } from '../lib/subspaceService';
import { subspace } from '../subspace';

export let subspaceSessionTemplateService = createSubspaceService(
  subspace.sessionTemplate,
  ['get', 'list', 'create', 'update', 'delete'],
  inner => ({
    create: async (...params: Parameters<typeof inner.create>) => {
      let eventBase = toEventBase(params[0]);
      await Fabric.fire('provider.session_template.created:before', eventBase);

      let sessionTemplate = await inner.create(...params);

      await Fabric.fire('provider.session_template.created:after', {
        ...eventBase,
        sessionTemplate
      });

      return sessionTemplate;
    },
    update: async (...params: Parameters<typeof inner.update>) => {
      let eventBase = toEventBase(params[0]);
      await Fabric.fire('provider.session_template.updated:before', eventBase);

      let sessionTemplate = await inner.update(...params);

      await Fabric.fire('provider.session_template.updated:after', {
        ...eventBase,
        sessionTemplate
      });

      return sessionTemplate;
    },
    delete: async (...params: Parameters<typeof inner.delete>) => {
      let eventBase = toEventBase(params[0]);
      await Fabric.fire('provider.session_template.deleted:before', eventBase);

      let sessionTemplate = await inner.delete(...params);

      await Fabric.fire('provider.session_template.deleted:after', {
        ...eventBase,
        sessionTemplate
      });

      return sessionTemplate;
    }
  })
);

export type SubspaceSessionTemplate = Awaited<ReturnType<typeof subspace.sessionTemplate.get>>;
