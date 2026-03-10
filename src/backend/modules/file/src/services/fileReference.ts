import { forbiddenError, notFoundError, ServiceError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import { getConfig } from '@metorial/config';
import { db, EntityImage, File, FileLink, ID, withTransaction } from '@metorial/db';
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

class FileReferenceServiceImpl {
  private async createFileReference(d: {
    fileLink: FileLink & { file: File };
    entityType: string;
    entityId: string;
  }) {
    return withTransaction(
      async db => {
        return await db.fileReference.create({
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
      },
      { ifExists: true }
    );
  }

  async hasReferences(d: { fileLink: FileLink }) {
    let count = await db.fileReference.count({
      where: { fileLinkOid: d.fileLink.oid }
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

  async createImageEntityImage(d: {
    fileId: string;
    owner: ImageFileOwner;
    purpose: string;
    entityType: string;
    entityId: string;
  }): Promise<EntityImage> {
    return withTransaction(async db => {
      let file = await db.file.findFirst({
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

      let link = await db.fileLink.create({
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
        entityId: d.entityId
      });

      let fileUrl = `${getConfig().urls.filesUrl}/files/${file.id}/${link.key}`;

      return {
        type: 'file' as const,
        fileId: file.id,
        fileLinkId: link.id,
        fileReferenceId: ref.id,
        fileUrl
      };
    });
  }

  async cleanupImageEntityImage(d: { image: EntityImage | null | undefined }) {
    if (d.image?.type != 'file' || !d.image.fileReferenceId || !d.image.fileLinkId) return;

    let img = d.image;

    return withTransaction(async db => {
      await db.fileReference.deleteMany({
        where: {
          id: img.fileReferenceId
        }
      });

      let remainingReferences = await db.fileReference.count({
        where: {
          fileLink: {
            id: img.fileLinkId
          }
        }
      });

      if (remainingReferences === 0) {
        await db.fileLink.deleteMany({
          where: {
            id: img.fileLinkId
          }
        });
      }
    });
  }
}

export let fileReferenceService = Service.create(
  'fileReference',
  () => new FileReferenceServiceImpl()
).build();
