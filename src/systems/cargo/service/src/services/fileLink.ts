import {
  badRequestError,
  forbiddenError,
  notFoundError,
  ServiceError
} from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import { generatePlainId } from '@lowerdeck/id';
import type { FileLink, Prisma, PrismaClient } from '../../prisma/generated/client';
import { db } from '../db';
import { env } from '../env';
import { getId } from '../id';
import { fileReferenceService } from './fileReference';
import type { CargoTenantEnvironment } from './filePurpose';

let include = {
  file: {
    include: {
      document: {
        select: {
          id: true
        }
      },
      purpose: true
    }
  },
  tenant: true,
  environment: true
};

type DbClient = PrismaClient | Prisma.TransactionClient;

class FileLinkServiceImpl {
  private getGeneratedKey() {
    return `${generatePlainId(30)}_${env.service.CARGO_REGION ?? 'ext'}`;
  }

  async createFileLink(
    d: CargoTenantEnvironment & {
      file: {
        oid: bigint;
        id: string;
        purpose: {
          canHaveLinks: boolean;
        };
      };
      input: {
        id?: string;
        key?: string;
        expiresAt?: Date;
      };
      client?: DbClient;
    }
  ) {
    if (!d.file.purpose.canHaveLinks) {
      throw new ServiceError(
        forbiddenError({
          message: 'File purpose does not allow creating links'
        })
      );
    }

    let client = d.client ?? db;

    let existing = d.input.id
      ? await client.fileLink.findFirst({
          where: {
            tenantOid: d.tenant.oid,
            environmentOid: d.environment.oid,
            OR: [{ id: d.input.id }, ...(d.input.key ? [{ key: d.input.key }] : [])]
          }
        })
      : d.input.key
        ? await client.fileLink.findFirst({
            where: {
              tenantOid: d.tenant.oid,
              environmentOid: d.environment.oid,
              key: d.input.key
            }
          })
        : undefined;

    if (existing) {
      return await client.fileLink.update({
        where: {
          id: existing.id
        },
        data: {
          fileOid: d.file.oid,
          expiresAt: d.input.expiresAt,
          key: d.input.key ?? existing.key
        },
        include
      });
    }

    let generated = getId('fileLink');

    return await client.fileLink.create({
      data: {
        oid: generated.oid,
        id: d.input.id ?? generated.id,
        key: d.input.key ?? this.getGeneratedKey(),
        fileOid: d.file.oid,
        tenantOid: d.tenant.oid,
        environmentOid: d.environment.oid,
        expiresAt: d.input.expiresAt
      },
      include
    });
  }

  async deleteFileLink(d: {
    fileLink: FileLink;
  }) {
    let hasRefs = await fileReferenceService.hasReferences({
      fileLink: d.fileLink
    });

    if (hasRefs) {
      throw new ServiceError(
        badRequestError({
          message: 'Cannot delete link: it has active references'
        })
      );
    }

    return await db.fileLink.delete({
      where: {
        id: d.fileLink.id
      },
      include
    });
  }

  async listFileLinks(
    d: CargoTenantEnvironment & {
      fileId?: string[];
    }
  ) {
    return Paginator.create(({ prisma }) =>
      prisma(async opts =>
        await db.fileLink.findMany({
          ...opts,
          where: {
            tenantOid: d.tenant.oid,
            environmentOid: d.environment.oid,
            file: {
              status: 'active',
              ...(d.fileId
                ? {
                    id: {
                      in: d.fileId
                    }
                  }
                : {})
            }
          },
          include
        })
      )
    );
  }

  async getFileLinkById(
    d: CargoTenantEnvironment & {
      fileLinkId: string;
    }
  ) {
    let fileLink = await db.fileLink.findFirst({
      where: {
        tenantOid: d.tenant.oid,
        environmentOid: d.environment.oid,
        id: d.fileLinkId
      },
      include
    });

    if (!fileLink) throw new ServiceError(notFoundError('fileLink', d.fileLinkId));

    return fileLink;
  }

  async getFileLinkByKey(d: {
    fileId: string;
    key: string;
  }) {
    let fileLink = await db.fileLink.findFirst({
      where: {
        key: d.key,
        file: {
          id: d.fileId,
          status: 'active'
        }
      },
      include
    });

    if (!fileLink) throw new ServiceError(notFoundError('fileLink', d.key));

    return {
      link: fileLink,
      file: fileLink.file
    };
  }
}

export let fileLinkService = Service.create(
  'cargoFileLinkService',
  () => new FileLinkServiceImpl()
).build();
