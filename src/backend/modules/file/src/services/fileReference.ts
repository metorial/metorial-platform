import { forbiddenError, notFoundError, ServiceError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import { db, EntityImage, ID, TransactionDB } from '@metorial/db';
import { getConfig } from '@metorial/config';
import { generatePlainId } from '@metorial/id';

export type ImageFileOwner =
  | {
      type: 'user';
      userId: string;
    }
  | {
      type: 'organization';
      organizationId: string;
    };

let getDatabase = (database?: TransactionDB) => database ?? db;

class FileReferenceServiceImpl {
  private async createFileReference(d: {
    fileLink: { oid: bigint; file: { id: string } };
    entityType: string;
    entityId: string;
    database?: TransactionDB;
  }) {
    let database = getDatabase(d.database);

    return await database.fileReference.create({
      data: {
        id: await ID.generateId('fileRef'),
        fileLinkOid: d.fileLink.oid,
        entityType: d.entityType,
        entityId: d.entityId
      },
      include: {
        fileLink: {
          include: {
            file: true
          }
        }
      }
    });
  }

  async hasReferences(d: { fileLinkOid: bigint }) {
    let count = await db.fileReference.count({
      where: { fileLinkOid: d.fileLinkOid }
    });
    return count > 0;
  }

  async hasReferencesForFile(d: { fileOid: bigint }) {
    let count = await db.fileReference.count({
      where: {
        fileLink: {
          fileOid: d.fileOid
        }
      }
    });
    return count > 0;
  }

  async createImageEntityImage(d: {
    fileId: string;
    owner: ImageFileOwner;
    purpose: string;
    entityType: string;
    entityId: string;
    database?: TransactionDB;
  }): Promise<EntityImage> {
    let database = getDatabase(d.database);

    let file = await database.file.findFirst({
      where: {
        id: d.fileId,
        status: 'active',
        purpose: {
          slug: d.purpose
        },
        ...(d.owner.type == 'user'
          ? {
              user: {
                id: d.owner.userId
              }
            }
          : {
              organization: {
                id: d.owner.organizationId
              }
            })
      },
      include: { purpose: true }
    });
    if (!file) {
      throw new ServiceError(notFoundError('file', d.fileId));
    }

    if (!file.purpose.canHaveLinks) {
      throw new ServiceError(
        forbiddenError({
          message: 'File purpose does not allow creating links'
        })
      );
    }

    let link = await database.fileLink.create({
      data: {
        id: await ID.generateId('fileLink'),
        fileOid: file.oid,
        key: await generatePlainId(30)
      },
      include: {
        file: true
      }
    });

    let ref = await this.createFileReference({
      fileLink: link,
      entityType: d.entityType,
      entityId: d.entityId,
      database
    });

    let fileUrl = `${getConfig().urls.filesUrl}/files/${file.id}/${link.key}`;

    return {
      type: 'file' as const,
      fileId: file.id,
      fileLinkId: link.id,
      fileReferenceId: ref.id,
      fileUrl
    };
  }

  async cleanupImageEntityImage(d: {
    image: EntityImage | null | undefined;
    database?: TransactionDB;
  }) {
    if (d.image?.type != 'file' || !d.image.fileReferenceId || !d.image.fileLinkId) {
      return;
    }

    let database = getDatabase(d.database);

    await database.fileReference.deleteMany({
      where: {
        id: d.image.fileReferenceId
      }
    });

    let remainingReferences = await database.fileReference.count({
      where: {
        fileLink: {
          id: d.image.fileLinkId
        }
      }
    });

    if (remainingReferences === 0) {
      await database.fileLink.deleteMany({
        where: {
          id: d.image.fileLinkId
        }
      });
    }
  }
}

export let fileReferenceService = Service.create(
  'fileReference',
  () => new FileReferenceServiceImpl()
).build();
