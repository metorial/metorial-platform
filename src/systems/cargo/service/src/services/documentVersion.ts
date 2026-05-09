import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import type { Prisma, StoreParticipantPermissions } from '../../prisma/generated/client';
import { db } from '../db';
import type { CargoTenantEnvironment } from './filePurpose';
import { storeAccessService, storeReadPermission } from './storeAccess';

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

    if (!version) throw new ServiceError(notFoundError('documentVersion', d.documentVersionId));

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
      prisma(async opts =>
        await db.documentVersion.findMany({
          ...opts,
          where: {
            tenantOid: d.tenant.oid,
            environmentOid: d.environment.oid,
            document: {
              id: d.documentId,
              file: {
                status: 'active'
              }
            }
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
