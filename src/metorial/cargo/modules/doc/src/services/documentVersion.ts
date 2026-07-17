import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import {
  type DateFilter,
  normalizeDateFilter,
  resolveDocumentVersions,
  resolveResourceActors
} from '@metorial/cargo-list-utils';
import type { CargoResourceScope } from '@metorial/cargo-module-file';
import { storeAccessService, storeReadPermission } from '@metorial/cargo-module-store';
import type { Prisma, StoreParticipantPermissions } from '@metorial/db';
import { db } from '@metorial/db';

export let documentVersionInclude = {
  document: true,
  previousVersion: true,
  content: true,
  documentVersionEditors: {
    include: {
      resourceActor: true
    }
  }
} satisfies Prisma.DocumentVersionInclude;

class DocumentVersionServiceImpl {
  async getDocumentVersionById(
    d: CargoResourceScope & {
      documentVersionId: string;
      actorId?: string;
      defaultPermissions?: StoreParticipantPermissions[];
      overridePermissions?: boolean;
    }
  ) {
    let version = await db.documentVersion.findFirst({
      where: {
        resourceTenantOid: d.resourceTenant.oid,
        resourceGroupOid: d.resourceGroup.oid,
        id: d.documentVersionId,
        document: {
          file: {
            status: 'active'
          }
        }
      },
      include: documentVersionInclude
    });

    if (!version)
      throw new ServiceError(notFoundError('documentVersion', d.documentVersionId));

    await storeAccessService.assertStoreAccessForDocument({
      resourceTenant: d.resourceTenant,
      resourceGroup: d.resourceGroup,
      document: version.document,
      actorId: d.actorId,
      defaultPermissions: d.defaultPermissions,
      overridePermissions: d.overridePermissions,
      requiredPermission: storeReadPermission
    });

    return version;
  }

  async listDocumentVersions(
    d: CargoResourceScope & {
      documentId: string;
      ids?: string[];
      editorActorIds?: string[];
      createdAt?: DateFilter;
      listEditedAt?: DateFilter;
      actorId?: string;
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
      },
      select: {
        oid: true,
        id: true,
        fileOid: true,
        createdByResourceActorOid: true
      }
    });

    if (!document) throw new ServiceError(notFoundError('document', d.documentId));

    let versions = await resolveDocumentVersions(d, d.ids);
    let editorActors = await resolveResourceActors(d, d.editorActorIds);

    await storeAccessService.assertStoreAccessForDocument({
      resourceTenant: d.resourceTenant,
      resourceGroup: d.resourceGroup,
      document,
      actorId: d.actorId,
      defaultPermissions: d.defaultPermissions,
      overridePermissions: d.overridePermissions,
      requiredPermission: storeReadPermission
    });

    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.documentVersion.findMany({
            ...opts,
            where: {
              resourceTenantOid: d.resourceTenant.oid,
              resourceGroupOid: d.resourceGroup.oid,
              oid: versions ? versions.in : undefined,
              document: {
                id: d.documentId,
                file: {
                  status: 'active'
                }
              },
              AND: [
                editorActors
                  ? {
                      documentVersionEditors: {
                        some: {
                          resourceActorOid: editorActors.in
                        }
                      }
                    }
                  : undefined!,
                d.createdAt ? { createdAt: normalizeDateFilter(d.createdAt) } : undefined!,
                d.listEditedAt
                  ? { listEditedAt: normalizeDateFilter(d.listEditedAt) }
                  : undefined!
              ].filter(Boolean)
            },
            include: documentVersionInclude,
            orderBy: {
              versionNumber: 'desc'
            }
          })
      )
    );
  }
}

export let documentVersionService = Service.create(
  'cargoDocumentVersionService',
  () => new DocumentVersionServiceImpl()
).build();
