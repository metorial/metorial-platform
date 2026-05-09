import { badRequestError, notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import type {
  File,
  FileLink,
  FileReference,
  Prisma,
  PrismaClient
} from '../../prisma/generated/client';
import { db } from '../db';
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

type DbClient = PrismaClient | Prisma.TransactionClient;

class FileReferenceServiceImpl {
  async upsertFileReference(
    d: CargoTenantEnvironment & {
      fileLink: FileLink;
      input: {
        id?: string;
        entityType: string;
        entityId: string;
      };
      client?: DbClient;
    }
  ) {
    let client = d.client ?? db;

    let existing = d.input.id
      ? await client.fileReference.findFirst({
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
      : await client.fileReference.findFirst({
          where: {
            tenantOid: d.tenant.oid,
            environmentOid: d.environment.oid,
            fileLinkOid: d.fileLink.oid,
            entityType: d.input.entityType,
            entityId: d.input.entityId
          }
        });

    if (existing) {
      return await client.fileReference.update({
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

    return await client.fileReference.create({
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
    client?: DbClient;
  }) {
    let runCleanup = async (client: DbClient) => {
      await client.fileReference.delete({
        where: {
          id: d.fileReference.id
        }
      });

      let remainingReferences = await client.fileReference.count({
        where: {
          fileLinkOid: d.fileReference.fileLinkOid
        }
      });

      if (remainingReferences === 0) {
        await client.fileLink.deleteMany({
          where: {
            oid: d.fileReference.fileLinkOid
          }
        });
      }
    };

    if (d.client) {
      return await runCleanup(d.client);
    }

    return await db.$transaction(async client => await runCleanup(client));
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
