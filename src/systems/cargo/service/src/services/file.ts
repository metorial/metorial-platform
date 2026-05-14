import {
  badRequestError,
  forbiddenError,
  notFoundError,
  ServiceError
} from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import type { File, Prisma, StoreParticipantPermissions } from '../../prisma/generated/client';
import { db, withTransaction } from '../db';
import { getId } from '../id';
import { actorService } from './actor';
import { getEffectiveDocumentStoreSourceByDocumentId } from './documentContentStore';
import { documentDraftService } from './documentDraft';
import {
  documentFilePurposeSlug,
  filePurposeService,
  type CargoTenantEnvironment
} from './filePurpose';
import { fileReferenceService } from './fileReference';
import {
  storeAccessService,
  storeReadPermission,
  storeWritePermission
} from './storeAccess';
import { storeItemMutationService } from './storeItemMutation';

let include = {
  purpose: true,
  document: {
    select: {
      id: true
    }
  },
  createdByTenantActor: true,
  tenant: true,
  environment: true
} satisfies Prisma.FileInclude;

type FileRecord = Prisma.FileGetPayload<{
  include: typeof include;
}>;
type FileAccessInput = {
  actorId?: string;
  defaultPermissions?: StoreParticipantPermissions[];
  overridePermissions?: boolean;
};

class FileServiceImpl {
  private assertFileWritable(file: Pick<File, 'id' | 'isReadOnly'>) {
    if (file.isReadOnly) {
      throw new ServiceError(
        forbiddenError({
          message: `File ${file.id} is read-only`
        })
      );
    }
  }

  private async withEffectiveStoreId<T extends FileRecord>(file: T) {
    if (!file.document?.id) {
      return file as T & { effectiveStoreId?: string };
    }

    let effectiveStoreSource = await getEffectiveDocumentStoreSourceByDocumentId(file.document.id);
    if (!effectiveStoreSource || effectiveStoreSource.file.storeId === file.storeId) {
      return file as T & { effectiveStoreId?: string };
    }

    return {
      ...file,
      effectiveStoreId: effectiveStoreSource.file.storeId
    } satisfies T & { effectiveStoreId?: string };
  }

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
      internal?: {
        isReadOnly?: boolean;
        isTemplateBacking?: boolean;
        allowReadOnlyStore?: boolean;
      };
      input: {
        id?: string;
        name: string;
        mimeType: string;
        size: number;
        title?: string;
        actorId?: string;
        store?: {
          id: string;
          path: string;
        };
        defaultPermissions?: StoreParticipantPermissions[];
        overridePermissions?: boolean;
      };
    }
  ): Promise<FileRecord> {
    return await withTransaction(async db => {
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

      let actor = d.input.actorId
        ? await actorService.getActorById({
            tenant: d.tenant,
            actorId: d.input.actorId
          })
        : undefined;

      let existing = d.input.id
        ? await db.file.findFirst({
            where: {
              tenantOid: d.tenant.oid,
              environmentOid: d.environment.oid,
              id: d.input.id
            }
          })
        : undefined;

      if (existing) {
        let updatedFile = await db.file.update({
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
            purposeOid: purpose.oid,
            isReadOnly: d.internal?.isReadOnly ?? existing.isReadOnly,
            isTemplateBacking: d.internal?.isTemplateBacking ?? existing.isTemplateBacking,
            createdByTenantActorOid: existing.createdByTenantActorOid ?? actor?.oid
          },
          include
        });

        if (d.input.store) {
          let store = await storeAccessService.getStoreById({
            tenant: d.tenant,
            environment: d.environment,
            storeId: d.input.store.id
          });

          await storeAccessService.assertStoreAccessForStore({
            tenant: d.tenant,
            environment: d.environment,
            store,
            actorId: d.input.actorId,
            defaultPermissions: d.input.defaultPermissions,
            overridePermissions: d.input.overridePermissions,
            requiredPermission: storeWritePermission
          });

          await storeItemMutationService.attachTargetToStore({
            tenant: d.tenant,
            environment: d.environment,
            store,
            path: d.input.store.path,
            target: {
              file: updatedFile,
              document: null
            },
            actor,
            allowReadOnly: d.internal?.allowReadOnlyStore
          });
        }

        return await this.withEffectiveStoreId(updatedFile);
      }

      let generated = getId('file');

      let createdFile = await db.file.create({
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
          title: d.input.title,
          isReadOnly: d.internal?.isReadOnly ?? false,
          isTemplateBacking: d.internal?.isTemplateBacking ?? false,
          createdByTenantActorOid: actor?.oid
        },
        include
      });

      if (d.input.store) {
        let store = await storeAccessService.getStoreById({
          tenant: d.tenant,
          environment: d.environment,
          storeId: d.input.store.id
        });

        await storeAccessService.assertStoreAccessForStore({
          tenant: d.tenant,
          environment: d.environment,
          store,
          actorId: d.input.actorId,
          defaultPermissions: d.input.defaultPermissions,
          overridePermissions: d.input.overridePermissions,
          requiredPermission: storeWritePermission
        });

        await storeItemMutationService.attachTargetToStore({
          tenant: d.tenant,
          environment: d.environment,
          store,
          path: d.input.store.path,
          target: {
            file: createdFile,
            document: null
          },
            actor,
            allowReadOnly: d.internal?.allowReadOnlyStore
        });
      }

      return await this.withEffectiveStoreId(createdFile);
    });
  }

  async getFileById(
    d: CargoTenantEnvironment & {
      fileId: string;
    } & FileAccessInput
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

    await storeAccessService.assertStoreAccessForFile({
      tenant: d.tenant,
      environment: d.environment,
      file,
      actorId: d.actorId,
      defaultPermissions: d.defaultPermissions,
      overridePermissions: d.overridePermissions,
      requiredPermission: storeReadPermission
    });

    return await this.withEffectiveStoreId(file);
  }

  async updateFile(d: {
    file: File;
    input: {
      title?: string;
    };
  }) {
    await this.ensureFileActive(d.file);
    this.assertFileWritable(d.file);

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

  async deleteFileById(
    d: CargoTenantEnvironment & {
      fileId: string;
    } & FileAccessInput
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

    if (d.actorId) {
      let actor = await actorService.getActorById({
        tenant: d.tenant,
        actorId: d.actorId
      });

      if (!actor.organizationActorId && file.createdByTenantActorOid !== actor.oid) {
        throw new ServiceError(
          forbiddenError({
            message: `Only the creating actor can delete file ${file.id}`
          })
        );
      }
    }

    return await this.deleteFile({
      file
    });
  }

  async deleteFile(d: { file: File }) {
    await this.ensureFileActive(d.file);
    this.assertFileWritable(d.file);
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

    let { file, document } = await this.deleteFileWithClient(d.file);

    if (document) {
      await documentDraftService.clearDocumentState(document.id);
    }

    return file;
  }

  private async deleteFileWithClient(file: File) {
    return await withTransaction(async db => {
      let document = await db.document.findFirst({
        where: {
          fileOid: file.oid
        },
        select: {
          id: true
        }
      });

      let deletedFile = await db.file.update({
        where: {
          id: file.id
        },
        data: {
          status: 'deleted'
        },
        include
      });

      return {
        file: deletedFile,
        document
      };
    });
  }

  async listFiles(
    d: CargoTenantEnvironment & {
      purpose?: string[];
      includeDeleted?: boolean;
    } & FileAccessInput
  ) {
    let purposes = d.purpose
      ? await Promise.all(
          d.purpose.map(async id =>
            await filePurposeService.getFilePurposeById({
              id
            })
          )
        )
      : undefined;

    if (!d.actorId) {
      return Paginator.create(({ prisma }) =>
        prisma(async opts =>
          await Promise.all(
            (
              await db.file.findMany({
                ...opts,
                where: {
                  tenantOid: d.tenant.oid,
                  environmentOid: d.environment.oid,
                  status: d.includeDeleted ? undefined : 'active',
                  isTemplateBacking: false,
                  purposeOid: purposes
                    ? {
                        in: purposes.map(purpose => purpose.oid)
                      }
                    : undefined
                },
                include
              })
            ).map(async file => await this.withEffectiveStoreId(file))
          )
        )
      );
    }

    let access = await storeAccessService.listAccessibleStoreOidsForTenantEnvironment({
      tenant: d.tenant,
      environment: d.environment,
      actorId: d.actorId,
      defaultPermissions: d.defaultPermissions,
      overridePermissions: d.overridePermissions,
      requiredPermission: storeReadPermission
    });

    return Paginator.create(({ prisma }) =>
      prisma(async opts =>
        await Promise.all(
          (
            await db.file.findMany({
              ...opts,
              where: {
                tenantOid: d.tenant.oid,
                environmentOid: d.environment.oid,
                status: d.includeDeleted ? undefined : 'active',
                isTemplateBacking: false,
                purposeOid: purposes
                  ? {
                      in: purposes.map(purpose => purpose.oid)
                    }
                  : undefined,
                OR: [
                  {
                    createdByTenantActorOid: access.actor?.oid
                  },
                  {
                    storeItems: {
                      some: {
                        storeOid: {
                          in: access.accessibleStoreOids
                        }
                      }
                    }
                  }
                ]
              },
              include
            })
          ).map(async file => await this.withEffectiveStoreId(file))
        )
      )
    );
  }
}

export let fileService = Service.create(
  'cargoFileService',
  () => new FileServiceImpl()
).build();
