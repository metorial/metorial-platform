import { db, File, FileLink, FilePurpose, ID } from '@metorial/db';
import { forbiddenError, notFoundError, ServiceError } from '@metorial/error';
import { generatePlainId } from '@metorial/id';
import { Paginator } from '@metorial/pagination';
import { Service } from '@metorial/service';

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
        key: await generatePlainId(30)
      },
      include: {
        file: true
      }
    });
  }

  async getFileLinkById(d: { fileLinkId: string; file: File }) {
    let fileLink = await db.fileLink.findUnique({
      where: {
        id: d.fileLinkId,
        fileOid: d.file.oid
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

  async deleteFileLink(d: { fileLink: FileLink }) {
    return await db.fileLink.delete({
      where: {
        id: d.fileLink.id
      },
      include: {
        file: true
      }
    });
  }

  async updateFileLink(d: {
    fileLink: FileLink;
    input: {
      expiresAt?: Date;
    };
  }) {
    return await db.fileLink.update({
      where: {
        id: d.fileLink.id
      },
      data: {
        expiresAt: d.input.expiresAt
      },
      include: {
        file: true
      }
    });
  }

  async listFileLinks(d: { file: File }) {
    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.fileLink.findMany({
            ...opts,
            where: {
              fileOid: d.file.oid
            },
            include: {
              file: true
            }
          })
      )
    );
  }

  async getFileLinkByKey(d: { fileId: string; key: string }) {
    let fileLink = await db.fileLink.findUnique({
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
