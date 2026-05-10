import { badRequestError, notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import type {
  File,
  FileLink,
  FileReference,
  Prisma
} from '../../prisma/generated/client';
import { db, withTransaction } from '../db';
import { getId } from '../id';
import type { CargoTenantEnvironment } from './filePurpose';

let include = {
  fileLink: {
    include: {
      file: true
    }
  },
  tenant: true,
  environment: true
};

class FileReferenceServiceImpl {
  async upsertFileReference(
    d: CargoTenantEnvironment & {
      fileLink: FileLink;
      input: {
        id?: string;
        entityType: string;
        entityId: string;
      };
    }
  ) {
    return await withTransaction(async db => {
      let existing = d.input.id
        ? await db.fileReference.findFirst({
            where: {
              tenantOid: d.tenant.oid,
              environmentOid: d.environment.oid,
              OR: [
                { id: d.input.id },
                {
                  fileLinkOid: d.fileLink.oid,
                  entityType: d.input.entityType,
                  entityId: d.input.entityId
                }
              ]
            }
          })
        : await db.fileReference.findFirst({
            where: {
              tenantOid: d.tenant.oid,
              environmentOid: d.environment.oid,
              fileLinkOid: d.fileLink.oid,
              entityType: d.input.entityType,
              entityId: d.input.entityId
            }
          });

      if (existing) {
        return await db.fileReference.update({
          where: {
            id: existing.id
          },
          data: {
            fileLinkOid: d.fileLink.oid,
            entityType: d.input.entityType,
            entityId: d.input.entityId
          },
          include
        });
      }

      let generated = getId('fileRef');

      return await db.fileReference.create({
        data: {
          oid: generated.oid,
          id: d.input.id ?? generated.id,
          fileLinkOid: d.fileLink.oid,
          tenantOid: d.tenant.oid,
          environmentOid: d.environment.oid,
          entityType: d.input.entityType,
          entityId: d.input.entityId
        },
        include
      });
    });
  }

  async getFileReferenceById(
    d: CargoTenantEnvironment & {
      fileReferenceId: string;
    }
  ) {
    let fileReference = await db.fileReference.findFirst({
      where: {
        tenantOid: d.tenant.oid,
        environmentOid: d.environment.oid,
        id: d.fileReferenceId
      },
      include
    });

    if (!fileReference) {
      throw new ServiceError(notFoundError('fileReference', d.fileReferenceId));
    }

    return fileReference;
  }

  async listFileReferences(
    d: CargoTenantEnvironment & {
      fileLinkId?: string;
      entityType?: string;
      entityId?: string;
    }
  ) {
    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.fileReference.findMany({
            ...opts,
            where: {
              tenantOid: d.tenant.oid,
              environmentOid: d.environment.oid,
              fileLink: d.fileLinkId ? { id: d.fileLinkId } : undefined,
              entityType: d.entityType,
              entityId: d.entityId
            },
            include
          })
      )
    );
  }

  async deleteFileReference(d: { fileReference: FileReference }) {
    return await db.fileReference.delete({
      where: {
        id: d.fileReference.id
      },
      include
    });
  }

  async hasReferences(d: { fileLink: FileLink }) {
    let count = await db.fileReference.count({
      where: {
        fileLinkOid: d.fileLink.oid
      }
    });

    return count > 0;
  }

  async hasReferencesForFile(d: { file: File }) {
    let count = await db.fileReference.count({
      where: {
        fileLink: {
          fileOid: d.file.oid
        }
      }
    });

    return count > 0;
  }

  async deleteReferenceAndLinkIfUnused(d: {
    fileReference: FileReference;
  }) {
    return await withTransaction(async db => {
      await db.fileReference.delete({
        where: {
          id: d.fileReference.id
        }
      });

      let remainingReferences = await db.fileReference.count({
        where: {
          fileLinkOid: d.fileReference.fileLinkOid
        }
      });

      if (remainingReferences === 0) {
        await db.fileLink.deleteMany({
          where: {
            oid: d.fileReference.fileLinkOid
          }
        });
      }
    });
  }

  async deleteFileReferenceByIdAndCleanup(d: { fileReferenceId: string }) {
    let fileReference = await db.fileReference.findUnique({
      where: {
        id: d.fileReferenceId
      }
    });
    if (!fileReference) return null;

    await this.deleteReferenceAndLinkIfUnused({
      fileReference
    });

    return fileReference;
  }
}

export let fileReferenceService = Service.create(
  'cargoFileReferenceService',
  () => new FileReferenceServiceImpl()
).build();
