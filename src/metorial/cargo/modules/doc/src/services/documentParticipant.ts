import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import {
  type DateFilter,
  normalizeDateFilter,
  resolveDocumentParticipants,
  resolveDocuments,
  resolveResourceActors
} from '@metorial/cargo-list-utils';
import type { ResourceScope } from '@metorial/module-resource-tenant';
import {
  type StoreAccessInput,
  storeAccessService,
  storeReadPermission
} from '@metorial/cargo-module-store';
import type { Prisma, StoreParticipantPermissions } from '@metorial/db';
import { db } from '@metorial/db';
import { internalDocumentParticipantService } from '../internal/documentParticipant';

export let documentParticipantInclude = {
  document: true,
  resourceActor: true
} satisfies Prisma.DocumentParticipantInclude;

class DocumentParticipantServiceImpl {
  async getDocumentParticipantById(
    d: ResourceScope & {
      documentParticipantId: string;
      actorId?: string;
      accessTags?: StoreAccessInput['accessTags'];
      defaultPermissions?: StoreParticipantPermissions[];
      overridePermissions?: boolean;
    }
  ) {
    let participant = await db.documentParticipant.findFirst({
      where: {
        document: {
          resourceTenantOid: d.resourceTenant.oid,
          resourceGroupOid: d.resourceGroup.oid,
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
      resourceTenant: d.resourceTenant,
      resourceGroup: d.resourceGroup,
      document: participant.document,
      actorId: d.actorId,
      accessTags: d.accessTags,
      defaultPermissions: d.defaultPermissions,
      overridePermissions: d.overridePermissions,
      requiredPermission: storeReadPermission
    });

    return participant;
  }

  async listDocumentParticipants(
    d: ResourceScope & {
      documentId: string;
      ids?: string[];
      actorIds?: string[];
      createdAt?: DateFilter;
      lastEditedAt?: DateFilter;
      lastViewedAt?: DateFilter;
      actorId?: string;
      accessTags?: StoreAccessInput['accessTags'];
      defaultPermissions?: StoreParticipantPermissions[];
      overridePermissions?: boolean;
    }
  ) {
    let document = await db.document.findFirst({
      where: {
        resourceTenantOid: d.resourceTenant.oid,
        resourceGroupOid: d.resourceGroup.oid,
        id: d.documentId,
        file: {
          status: 'active'
        }
      }
    });

    if (!document) throw new ServiceError(notFoundError('document', d.documentId));

    await storeAccessService.assertStoreAccessForDocument({
      resourceTenant: d.resourceTenant,
      resourceGroup: d.resourceGroup,
      document,
      actorId: d.actorId,
      accessTags: d.accessTags,
      defaultPermissions: d.defaultPermissions,
      overridePermissions: d.overridePermissions,
      requiredPermission: storeReadPermission
    });

    await internalDocumentParticipantService.materializeDocumentParticipantsFromStores({
      document
    });
    let participants = await resolveDocumentParticipants(d, d.ids);
    let documents = await resolveDocuments(d, [d.documentId]);
    let actors = await resolveResourceActors(d, d.actorIds);

    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.documentParticipant.findMany({
            ...opts,
            where: {
              oid: participants ? participants.in : undefined,
              document: {
                resourceTenantOid: d.resourceTenant.oid,
                resourceGroupOid: d.resourceGroup.oid,
                oid: documents ? documents.in : undefined,
                file: {
                  status: 'active'
                }
              },
              resourceActorOid: actors ? actors.in : undefined,
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
