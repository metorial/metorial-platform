import {
  badRequestError,
  forbiddenError,
  notFoundError,
  ServiceError
} from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import { db, File, FileLink, FilePurpose, ID, Organization } from '@metorial/db';
import { generatePlainId } from '@metorial/id';
import { env } from '../env';
import { fileReferenceService } from './fileReference';

class FileLinkServiceImpl {
  async createFileLink(d: {
    file: File & { purpose: FilePurpose };
    input: {
      expiresAt?: Date;
    };
  }) {
    if (!d.file.purpose.canHaveLinks) {
      throw new ServiceError(
        forbiddenError({
          message: 'File purpose does not allow creating links'
        })
      );
    }

    return await db.fileLink.create({
      data: {
        id: await ID.generateId('fileLink'),
        fileOid: d.file.oid,
        expiresAt: d.input.expiresAt,
        key: `${generatePlainId(30)}_${env.service.METORIAL_REGION ?? 'ext'}`
      },
      include: {
        file: true
      }
    });
  }

  async deleteFileLink(d: { fileLink: FileLink }) {
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
      include: {
        file: true
      }
    });
  }

  async listFileLinksForOrganization(d: { organization: Organization; fileId?: string }) {
    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.fileLink.findMany({
            ...opts,
            where: {
              file: {
                organizationOid: d.organization.oid,
                status: 'active',
                ...(d.fileId ? { id: d.fileId } : {})
              }
            },
            include: {
              file: true
            }
          })
      )
    );
  }

  async getFileLinkByIdForOrganization(d: { fileLinkId: string; organization: Organization }) {
    let fileLink = await db.fileLink.findFirst({
      where: {
        id: d.fileLinkId,
        file: {
          organizationOid: d.organization.oid,
          status: 'active'
        }
      },
      include: {
        file: true
      }
    });
    if (!fileLink) {
      throw new ServiceError(notFoundError('fileLink', d.fileLinkId));
    }

    return fileLink;
  }

  async getFileLinkByKey(d: { fileId: string; key: string }) {
    let fileLink = await db.fileLink.findFirst({
      where: {
        key: d.key,
        file: {
          id: d.fileId,
          status: 'active'
        }
      },
      include: {
        file: true
      }
    });
    if (!fileLink) {
      throw new ServiceError(notFoundError('fileLink', d.key));
    }

    return {
      link: fileLink,
      file: fileLink.file
    };
  }
}

export let fileLinkService = Service.create(
  'fileLink',
  () => new FileLinkServiceImpl()
).build();
