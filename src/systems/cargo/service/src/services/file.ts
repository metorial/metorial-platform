import {
  badRequestError,
  forbiddenError,
  notFoundError,
  ServiceError
} from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import type { File, Prisma, PrismaClient } from '../../prisma/generated/client';
import { db } from '../db';
import { getId } from '../id';
import {
  documentFilePurposeSlug,
  filePurposeService,
  type CargoTenantEnvironment
} from './filePurpose';
import { fileReferenceService } from './fileReference';

let include = {
  purpose: true,
  tenant: true,
  environment: true
};

type DbClient = PrismaClient | Prisma.TransactionClient;

class FileServiceImpl {
  private async ensureFileActive(file: File) {
    if (file.status !== 'active') {
      throw new ServiceError(
        forbiddenError({
          message: 'Cannot perform this action on a deleted file'
        })
      );
    }
  }

  async createFile(
    d: CargoTenantEnvironment & {
      purpose: string;
      storeId: string;
      _isDocument?: boolean;
      client?: DbClient;
      input: {
        id?: string;
        name: string;
        mimeType: string;
        size: number;
        title?: string;
      };
    }
  ) {
    let purpose = await filePurposeService.getFilePurposeById({
      id: d.purpose
    });
    if (purpose.slug === documentFilePurposeSlug && !d._isDocument) {
      throw new ServiceError(
        badRequestError({
          message: 'Document purpose cannot be used for normal file creation'
        })
      );
    }

    let client = d.client ?? db;

    let existing = d.input.id
      ? await client.file.findFirst({
          where: {
            tenantOid: d.tenant.oid,
            environmentOid: d.environment.oid,
            id: d.input.id
          }
        })
      : undefined;

    if (existing) {
      return await client.file.update({
        where: {
          id: existing.id
        },
        data: {
          storeId: d.storeId,
          fileName: d.input.name,
          fileSize: d.input.size,
          fileType: d.input.mimeType,
          title: d.input.title,
          status: 'active',
          purposeOid: purpose.oid
        },
        include
      });
    }

    let generated = getId('file');

    return await client.file.create({
      data: {
        oid: generated.oid,
        id: d.input.id ?? generated.id,
        tenantOid: d.tenant.oid,
        environmentOid: d.environment.oid,
        purposeOid: purpose.oid,
        storeId: d.storeId,
        fileName: d.input.name,
        fileSize: d.input.size,
        fileType: d.input.mimeType,
        title: d.input.title
      },
      include
    });
  }

  async getFileById(
    d: CargoTenantEnvironment & {
      fileId: string;
    }
  ) {
    let file = await db.file.findFirst({
      where: {
        tenantOid: d.tenant.oid,
        environmentOid: d.environment.oid,
        id: d.fileId
      },
      include
    });

    if (!file) throw new ServiceError(notFoundError('file', d.fileId));

    return file;
  }

  async updateFile(d: {
    file: File;
    input: {
      title?: string;
    };
  }) {
    await this.ensureFileActive(d.file);

    return await db.file.update({
      where: {
        id: d.file.id
      },
      data: {
        title: d.input.title
      },
      include
    });
  }

  async deleteFile(d: { file: File }) {
    await this.ensureFileActive(d.file);

    let hasRefs = await fileReferenceService.hasReferencesForFile({
      file: d.file
    });

    if (hasRefs) {
      throw new ServiceError(
        badRequestError({
          message: 'Cannot delete file: it has active references'
        })
      );
    }

    return await db.file.update({
      where: {
        id: d.file.id
      },
      data: {
        status: 'deleted'
      },
      include
    });
  }

  async listFiles(
    d: CargoTenantEnvironment & {
      purpose?: string;
      includeDeleted?: boolean;
    }
  ) {
    let purpose = d.purpose
      ? await filePurposeService.getFilePurposeById({
          id: d.purpose
        })
      : undefined;

    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.file.findMany({
            ...opts,
            where: {
              tenantOid: d.tenant.oid,
              environmentOid: d.environment.oid,
              status: d.includeDeleted ? undefined : 'active',
              purposeOid: purpose?.oid
            },
            include
          })
      )
    );
  }
}

export let fileService = Service.create(
  'cargoFileService',
  () => new FileServiceImpl()
).build();
