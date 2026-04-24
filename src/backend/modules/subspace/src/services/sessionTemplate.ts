import { badRequestError, ServiceError } from '@lowerdeck/error';
import { db } from '@metorial/db';
import { Fabric } from '@metorial/fabric';
import { createSubspaceService, toEventBase } from '../lib/subspaceService';
import { subspace } from '../subspace';

export let subspaceSessionTemplateService = createSubspaceService(
  subspace.sessionTemplate,
  ['get', 'getMany', 'list', 'create', 'update', 'delete', 'listTools'],
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
    update: async (
      arg0: Parameters<typeof inner.update>[0] & { _allowMagicMcpUpdate?: boolean }
    ) => {
      let eventBase = toEventBase(arg0);

      let magicMcpLink1 = await db.magicMcpSession.findFirst({
        where: { subspaceSessionTemplateId: arg0.sessionTemplateId }
      });
      let magicMcpLink2 = await db.magicMcpServer.findFirst({
        where: { subspaceSessionTemplateId: arg0.sessionTemplateId }
      });
      if ((magicMcpLink1 || magicMcpLink2) && !arg0._allowMagicMcpUpdate) {
        throw new ServiceError(
          badRequestError({
            message: 'This session template cannot be updated.'
          })
        );
      }

      await Fabric.fire('provider.session_template.updated:before', eventBase);

      let sessionTemplate = await inner.update(arg0);

      await Fabric.fire('provider.session_template.updated:after', {
        ...eventBase,
        sessionTemplate
      });

      return sessionTemplate;
    },
    delete: async (
      arg0: Parameters<typeof inner.delete>[0] & { _allowMagicMcpDelete?: boolean }
    ) => {
      let eventBase = toEventBase(arg0);

      let magicMcpLink1 = await db.magicMcpSession.findFirst({
        where: { subspaceSessionTemplateId: arg0.sessionTemplateId }
      });
      let magicMcpLink2 = await db.magicMcpServer.findFirst({
        where: { subspaceSessionTemplateId: arg0.sessionTemplateId }
      });
      if ((magicMcpLink1 || magicMcpLink2) && !arg0._allowMagicMcpDelete) {
        throw new ServiceError(
          badRequestError({
            message: 'This session template cannot be deleted.'
          })
        );
      }

      await Fabric.fire('provider.session_template.deleted:before', eventBase);

      let sessionTemplate = await inner.delete(arg0);

      await Fabric.fire('provider.session_template.deleted:after', {
        ...eventBase,
        sessionTemplate
      });

      return sessionTemplate;
    }
  })
);

export type SubspaceSessionTemplate = Awaited<ReturnType<typeof subspace.sessionTemplate.get>>;
