import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import type { Prisma } from '../../prisma/generated/client';
import { db } from '../db';
import type { CargoTenantEnvironment } from './filePurpose';

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

    return version;
  }

  async listDocumentVersions(
    d: CargoTenantEnvironment & {
      documentId: string;
    }
  ) {
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
