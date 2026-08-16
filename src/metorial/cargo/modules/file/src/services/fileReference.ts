import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import { getId } from '@metorial/cargo-config/id';
import {
  type CargoOwnerScope,
  type CargoScope,
  cargoFileScope,
  type DateFilter,
  normalizeDateFilter,
  resolveFileLinks,
  resolveFileReferences,
  resolveFiles
} from '@metorial/cargo-list-utils';
import type { File, FileLink, FileReference } from '@metorial/db';
import { db, withTransaction } from '@metorial/db';

let include = {
  fileLink: {
    include: {
      file: true
    }
  }
};

class FileReferenceServiceImpl {
  async upsertFileReference(
    d: CargoOwnerScope & {
      fileLink: FileLink;
      input: {
        id?: string;
        entityType: string;
        entityId: string;
      };
    }
  ) {
    return await withTransaction(async db => {
      let ownedLink = { fileLink: { file: cargoFileScope(d) } };

      let existing = d.input.id
        ? await db.fileReference.findFirst({
            where: {
              ...ownedLink,
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
              ...ownedLink,
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
          projectOid: 'project' in d ? d.project.oid : null,
          instanceOid: 'instance' in d ? d.instance.oid : null,
          entityType: d.input.entityType,
          entityId: d.input.entityId
        },
        include
      });
    });
  }

  async getFileReferenceById(
    d: CargoOwnerScope & {
      fileReferenceId: string;
    }
  ) {
    let fileReference = await db.fileReference.findFirst({
      where: {
        fileLink: { file: cargoFileScope(d) },
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
    d: CargoScope & {
      ids?: string[];
      fileLinkId?: string;
      fileLinkIds?: string[];
      fileIds?: string[];
      entityType?: string;
      entityId?: string;
      entityIds?: string[];
      createdAt?: DateFilter;
    }
  ) {
    let fileReferences = await resolveFileReferences(d, d.ids);
    let fileLinks = await resolveFileLinks(
      d,
      d.fileLinkIds ?? (d.fileLinkId ? [d.fileLinkId] : undefined)
    );
    let files = await resolveFiles(d, d.fileIds);

    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.fileReference.findMany({
            ...opts,
            where: {
              oid: fileReferences ? fileReferences.in : undefined,
              fileLink: {
                oid: fileLinks ? fileLinks.in : undefined,
                fileOid: files ? files.in : undefined,
                file: { instanceOid: d.instance.oid }
              },
              entityType: d.entityType,
              entityId: d.entityIds
                ? {
                    in: d.entityIds
                  }
                : d.entityId,
              createdAt: d.createdAt ? normalizeDateFilter(d.createdAt) : undefined
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

  async deleteReferenceAndLinkIfUnused(d: { fileReference: FileReference }) {
    return await withTransaction(async db => {
      await db.fileReference.deleteMany({
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
