import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import type { Prisma, StoreParticipantPermissions } from '../../prisma/generated/client';
import { db } from '../db';
import { documentService } from './document';
import type { CargoTenantEnvironment } from './filePurpose';
import { storeAccessService, storeReadPermission } from './storeAccess';

export let documentParticipantInclude = {
  document: true,
  tenantActor: true
} satisfies Prisma.DocumentParticipantInclude;

class DocumentParticipantServiceImpl {
  async getDocumentParticipantById(
    d: CargoTenantEnvironment & {
      documentParticipantId: string;
      actorId?: string;
      defaultPermissions?: StoreParticipantPermissions[];
      overridePermissions?: boolean;
    }
  ) {
    let participant = await db.documentParticipant.findFirst({
      where: {
        document: {
          tenantOid: d.tenant.oid,
          environmentOid: d.environment.oid,
          file: {
            status: 'active'
          }
        },
        id: d.documentParticipantId
      },
      include: documentParticipantInclude
    });

    if (!participant) {
      throw new ServiceError(notFoundError('documentParticipant', d.documentParticipantId));
    }

    await storeAccessService.assertStoreAccessForDocument({
      tenant: d.tenant,
      environment: d.environment,
      document: participant.document,
      actorId: d.actorId,
      defaultPermissions: d.defaultPermissions,
      overridePermissions: d.overridePermissions,
      requiredPermission: storeReadPermission
    });

    return participant;
  }

  async listDocumentParticipants(
    d: CargoTenantEnvironment & {
      documentId: string;
      actorId?: string;
      defaultPermissions?: StoreParticipantPermissions[];
      overridePermissions?: boolean;
    }
  ) {
    let document = await db.document.findFirst({
      where: {
        tenantOid: d.tenant.oid,
        environmentOid: d.environment.oid,
        id: d.documentId,
        file: {
          status: 'active'
        }
      }
    });

    if (!document) throw new ServiceError(notFoundError('document', d.documentId));

    await storeAccessService.assertStoreAccessForDocument({
      tenant: d.tenant,
      environment: d.environment,
      document,
      actorId: d.actorId,
      defaultPermissions: d.defaultPermissions,
      overridePermissions: d.overridePermissions,
      requiredPermission: storeReadPermission
    });

    await documentService.materializeDocumentParticipantsFromStores({
      document
    });

    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.documentParticipant.findMany({
            ...opts,
            where: {
              document: {
                tenantOid: d.tenant.oid,
                environmentOid: d.environment.oid,
                id: d.documentId,
                file: {
                  status: 'active'
                }
              }
            },
            include: documentParticipantInclude
          })
      )
    );
  }
}

export let documentParticipantService = Service.create(
  'cargoDocumentParticipantService',
  () => new DocumentParticipantServiceImpl()
).build();
