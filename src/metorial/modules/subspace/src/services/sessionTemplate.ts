import { badRequestError, ServiceError } from '@lowerdeck/error';
import { db } from '@metorial/db';
import { createSubspaceService } from '../lib/subspaceService';
import { subspace } from '../subspace';

export let subspaceSessionTemplateService = createSubspaceService(
  subspace.sessionTemplate,
  ['get', 'getMany', 'list', 'create', 'update', 'delete', 'listTools'],
  inner => ({
    update: async (
      arg0: Parameters<typeof inner.update>[0] & { _allowMagicMcpUpdate?: boolean }
    ) => {
      let magicMcpLink1 = await db.magicMcpSession.findFirst({
        where: { subspaceSessionTemplateId: arg0.sessionTemplateId }
      });
      let magicMcpLink2 = await db.magicMcpServer.findFirst({
        where: { legacySubspaceSessionTemplateId: arg0.sessionTemplateId }
      });
      let magicMcpLink3 = await db.magicMcpEndpoint.findFirst({
        where: { legacySubspaceSessionTemplateId: arg0.sessionTemplateId }
      });
      if ((magicMcpLink1 || magicMcpLink2 || magicMcpLink3) && !arg0._allowMagicMcpUpdate) {
        throw new ServiceError(
          badRequestError({
            message: 'This session template cannot be updated.'
          })
        );
      }

      return await inner.update(arg0);
    },
    delete: async (
      arg0: Parameters<typeof inner.delete>[0] & { _allowMagicMcpDelete?: boolean }
    ) => {
      let magicMcpLink1 = await db.magicMcpSession.findFirst({
        where: { subspaceSessionTemplateId: arg0.sessionTemplateId }
      });
      let magicMcpLink2 = await db.magicMcpServer.findFirst({
        where: { legacySubspaceSessionTemplateId: arg0.sessionTemplateId }
      });
      let magicMcpLink3 = await db.magicMcpEndpoint.findFirst({
        where: { legacySubspaceSessionTemplateId: arg0.sessionTemplateId }
      });
      if ((magicMcpLink1 || magicMcpLink2 || magicMcpLink3) && !arg0._allowMagicMcpDelete) {
        throw new ServiceError(
          badRequestError({
            message: 'This session template cannot be deleted.'
          })
        );
      }

      return await inner.delete(arg0);
    }
  })
);

export type SubspaceSessionTemplate = Awaited<ReturnType<typeof subspace.sessionTemplate.get>>;
