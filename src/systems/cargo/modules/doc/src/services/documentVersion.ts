import { notFoundError, ServiceError } from '@mtsrc/error';
import { Paginator } from '@mtsrc/pagination';
import { Service } from '@mtsrc/service';
import type { Prisma, StoreParticipantPermissions } from '@metorial-cargo/db';
import { db } from '@metorial-cargo/db';
import {
  type DateFilter,
  normalizeDateFilter,
  resolveDocumentVersions,
  resolveTenantActors
} from '@metorial-cargo/list-utils';
import type { CargoTenantEnvironment } from '@metorial-cargo/module-file';
import { storeAccessService, storeReadPermission } from '@metorial-cargo/module-store';

export let documentVersionInclude = {
  document: true,
  previousVersion: true,
  content: true,
  documentVersionEditors: {
    include: {
      tenantActor: true
    }
  }
} satisfies Prisma.DocumentVersionInclude;

class DocumentVersionServiceImpl {
  async getDocumentVersionById(
    d: CargoTenantEnvironment & {
      documentVersionId: string;
      actorId?: string;
      defaultPermissions?: StoreParticipantPermissions[];
      overridePermissions?: boolean;
    }
  ) {
    let version = await db.documentVersion.findFirst({
      where: {
        tenantOid: d.tenant.oid,
        environmentOid: d.environment.oid,
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
      tenant: d.tenant,
      environment: d.environment,
      document: version.document,
      actorId: d.actorId,
      defaultPermissions: d.defaultPermissions,
      overridePermissions: d.overridePermissions,
      requiredPermission: storeReadPermission
    });

    return version;
  }

  async listDocumentVersions(
    d: CargoTenantEnvironment & {
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
        tenantOid: d.tenant.oid,
        environmentOid: d.environment.oid,
        id: d.documentId,
        file: {
          status: 'active'
        }
      },
      select: {
        oid: true,
        id: true,
        fileOid: true,
        createdByTenantActorOid: true
      }
    });

    if (!document) throw new ServiceError(notFoundError('document', d.documentId));

    let versions = await resolveDocumentVersions(d, d.ids);
    let editorActors = await resolveTenantActors(d, d.editorActorIds);

    await storeAccessService.assertStoreAccessForDocument({
      tenant: d.tenant,
      environment: d.environment,
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
              tenantOid: d.tenant.oid,
              environmentOid: d.environment.oid,
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
                          tenantActorOid: editorActors.in
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
