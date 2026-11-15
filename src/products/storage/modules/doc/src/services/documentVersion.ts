import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import { storeAccessService, storeReadPermission } from '@metorial/module-store';
import type { Instance, Prisma, Project, StoreParticipantPermissions } from '@metorial/db';
import { db } from '@metorial/db';
import {
  type DateFilter,
  normalizeDateFilter,
  resolveDocumentVersions,
  resolveResourceActors
} from '@metorial/list-utils';
import type { ResourceAuthorization } from '@metorial/module-access';
import { resourceActorPresentationInclude } from '@metorial/module-resource-actor';

export let documentVersionInclude = {
  document: true,
  previousVersion: true,
  content: true,
  documentVersionEditors: {
    include: {
      resourceActor: {
        include: resourceActorPresentationInclude
      }
    }
  }
} satisfies Prisma.DocumentVersionInclude;

class DocumentVersionServiceImpl {
  async getDocumentVersionById(d: {
    project: Project;
    instance: Instance;
    documentVersionId: string;
    authorization: ResourceAuthorization;
    defaultPermissions?: StoreParticipantPermissions[];
    overridePermissions?: boolean;
  }) {
    let version = await db.documentVersion.findFirst({
      where: {
        projectOid: d.project.oid,
        instanceOid: d.instance.oid,
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
      project: d.project,
      instance: d.instance,
      document: version.document,
      authorization: d.authorization,
      defaultPermissions: d.defaultPermissions,
      overridePermissions: d.overridePermissions,
      requiredPermission: storeReadPermission
    });

    return version;
  }

  async listDocumentVersions(d: {
    project: Project;
    instance: Instance;
    documentId: string;
    ids?: string[];
    editorActorIds?: string[];
    createdAt?: DateFilter;
    listEditedAt?: DateFilter;
    authorization: ResourceAuthorization;
    defaultPermissions?: StoreParticipantPermissions[];
    overridePermissions?: boolean;
  }) {
    let document = await db.document.findFirst({
      where: {
        projectOid: d.project.oid,
        instanceOid: d.instance.oid,
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
      project: d.project,
      instance: d.instance,
      document,
      authorization: d.authorization,
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
              projectOid: d.project.oid,
              instanceOid: d.instance.oid,
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
