import { notFoundError, ServiceError } from '@mtsrc/error';
import { Paginator } from '@mtsrc/pagination';
import { Service } from '@mtsrc/service';
import type { Prisma, StoreParticipantPermissions } from '@metorial-cargo/db';
import { db } from '@metorial-cargo/db';
import {
  type DateFilter,
  normalizeDateFilter,
  resolveDocumentParticipants,
  resolveDocuments,
  resolveTenantActors
} from '@metorial-cargo/list-utils';
import type { CargoTenantEnvironment } from '@metorial-cargo/module-file';
import { storeAccessService, storeReadPermission } from '@metorial-cargo/module-store';
import { internalDocumentParticipantService } from '../internal/documentParticipant';

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
      ids?: string[];
      actorIds?: string[];
      createdAt?: DateFilter;
      lastEditedAt?: DateFilter;
      lastViewedAt?: DateFilter;
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

    await internalDocumentParticipantService.materializeDocumentParticipantsFromStores({
      document
    });
    let participants = await resolveDocumentParticipants(d, d.ids);
    let documents = await resolveDocuments(d, [d.documentId]);
    let actors = await resolveTenantActors(d, d.actorIds);

    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.documentParticipant.findMany({
            ...opts,
            where: {
              oid: participants ? participants.in : undefined,
              document: {
                tenantOid: d.tenant.oid,
                environmentOid: d.environment.oid,
                oid: documents ? documents.in : undefined,
                file: {
                  status: 'active'
                }
              },
              tenantActorOid: actors ? actors.in : undefined,
              createdAt: d.createdAt ? normalizeDateFilter(d.createdAt) : undefined,
              lastEditedAt: d.lastEditedAt ? normalizeDateFilter(d.lastEditedAt) : undefined,
              lastViewedAt: d.lastViewedAt ? normalizeDateFilter(d.lastViewedAt) : undefined
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
