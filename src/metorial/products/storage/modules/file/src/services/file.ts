import {
  badRequestError,
  forbiddenError,
  notFoundError,
  ServiceError
} from '@lowerdeck/error';
import { generatePlainId } from '@lowerdeck/id';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import {
  internalDocumentContentStoreService,
  internalDocumentDraftService
} from '@metorial/module-documents';
import {
  storeAccessService,
  storeItemMutationService,
  storeReadPermission,
  storeWritePermission
} from '@metorial/module-store';
import type {
  File,
  Instance,
  Prisma,
  Project,
  StoreParticipantPermissions
} from '@metorial/db';
import { db, ID, withTransaction } from '@metorial/db';
import {
  type DateFilter,
  normalizeDateFilter,
  resolveDocuments,
  resolveFileLinks,
  resolveFilePurposes,
  resolveFileReferences,
  resolveFiles,
  resolveResourceActors,
  resolveStores
} from '@metorial/list-utils';
import type { ResourceAuthorization } from '@metorial/module-access';
import { resourceActorPresentationInclude } from '@metorial/module-resource-actor';
import { cargoFileScope, type CargoOwnerScope } from '../internal/ownerScope';
import { requireInstanceScope } from '../lib/instanceScope';
import { getCargoFilesBucketName, getStorage } from '../storage';
import { documentFilePurposeSlug, filePurposeService } from './filePurpose';
import { fileReferenceService } from './fileReference';

let include = {
  purpose: true,
  document: {
    select: {
      id: true
    }
  },
  createdByResourceActor: {
    include: resourceActorPresentationInclude
  }
} satisfies Prisma.FileInclude;

type FileRecord = Prisma.FileGetPayload<{
  include: typeof include;
}>;
type FileAccessInput = {
  authorization: ResourceAuthorization;
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

  private async objectDataToBuffer(data: unknown) {
    if (Buffer.isBuffer(data)) return data;
    if (data instanceof ArrayBuffer) return Buffer.from(data);
    if (ArrayBuffer.isView(data)) {
      return Buffer.from(data.buffer, data.byteOffset, data.byteLength);
    }
    if (data instanceof Blob) return Buffer.from(await data.arrayBuffer());
    if (typeof data === 'string') return Buffer.from(data);

    return Buffer.from(await new Response(data as any).arrayBuffer());
  }

  private async withEffectiveStoreId<T extends FileRecord>(file: T) {
    if (!file.document?.id) {
      return file as T & { effectiveStoreId?: string };
    }

    let effectiveStoreSource =
      await internalDocumentContentStoreService.getEffectiveDocumentStoreSourceByDocumentId(
        file.document.id
      );
    if (!effectiveStoreSource || effectiveStoreSource.file.storeId === file.storeId) {
      return file as T & { effectiveStoreId?: string };
    }

    return {
      ...file,
      effectiveStoreId: effectiveStoreSource.file.storeId
    } satisfies T & { effectiveStoreId?: string };
  }

  private async ensureFileActive(file: Pick<File, 'status'>) {
    if (file.status !== 'active') {
      throw new ServiceError(
        forbiddenError({
          message: 'Cannot perform this action on a deleted file'
        })
      );
    }
  }

  async createFile(
    d: CargoOwnerScope & {
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
        expiresAt?: Date;
        authorization: ResourceAuthorization;
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

      let actor = d.input.authorization.resourceActor;

      let existing = d.input.id
        ? await db.file.findFirst({
            where: {
              ...cargoFileScope(d),
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
            expiresAt: d.input.expiresAt,
            status: 'active',
            purposeOid: purpose.oid,
            isReadOnly: d.internal?.isReadOnly ?? existing.isReadOnly,
            isTemplateBacking: d.internal?.isTemplateBacking ?? existing.isTemplateBacking,
            createdByResourceActorOid: existing.createdByResourceActorOid ?? actor?.oid
          },
          include
        });

        if (d.input.store) {
          let scope = requireInstanceScope(d, 'Attaching a file to a store');

          let store = await storeAccessService.getStoreById({
            ...scope,
            storeId: d.input.store.id
          });

          await storeAccessService.assertStoreAccessForStore({
            ...scope,
            store,
            authorization: d.input.authorization,
            defaultPermissions: d.input.defaultPermissions,
            overridePermissions: d.input.overridePermissions,
            requiredPermission: storeWritePermission
          });

          await storeItemMutationService.attachTargetToStore({
            ...scope,
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

      let createdFile = await db.file.create({
        data: {
          id: d.input.id ?? (await ID.generateId('file')),
          ...cargoFileScope(d),
          purposeOid: purpose.oid,
          storeId: d.storeId,
          fileName: d.input.name,
          fileSize: d.input.size,
          fileType: d.input.mimeType,
          title: d.input.title,
          expiresAt: d.input.expiresAt,
          isReadOnly: d.internal?.isReadOnly ?? false,
          isTemplateBacking: d.internal?.isTemplateBacking ?? false,
          createdByResourceActorOid: actor?.oid
        },
        include
      });

      if (d.input.store) {
        let scope = requireInstanceScope(d, 'Attaching a file to a store');

        let store = await storeAccessService.getStoreById({
          ...scope,
          storeId: d.input.store.id
        });

        await storeAccessService.assertStoreAccessForStore({
          ...scope,
          store,
          authorization: d.input.authorization,
          defaultPermissions: d.input.defaultPermissions,
          overridePermissions: d.input.overridePermissions,
          requiredPermission: storeWritePermission
        });

        await storeItemMutationService.attachTargetToStore({
          ...scope,
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
    d: CargoOwnerScope & {
      fileId: string;
    } & FileAccessInput
  ) {
    let file = await db.file.findFirst({
      where: {
        ...cargoFileScope(d),
        id: d.fileId
      },
      include
    });

    if (!file) throw new ServiceError(notFoundError('file', d.fileId));

    if ('instance' in d) {
      await storeAccessService.assertStoreAccessForFile({
        project: d.project,
        instance: d.instance,
        file,
        authorization: d.authorization,
        defaultPermissions: d.defaultPermissions,
        overridePermissions: d.overridePermissions,
        requiredPermission: storeReadPermission
      });
    }

    return await this.withEffectiveStoreId(file);
  }

  async downloadFileContent(d: {
    file: Pick<File, 'status' | 'storeId'> & { effectiveStoreId?: string };
  }) {
    await this.ensureFileActive(d.file);

    let object = await getStorage().getObject(
      getCargoFilesBucketName(),
      d.file.effectiveStoreId ?? d.file.storeId
    );

    return await this.objectDataToBuffer(object.data);
  }

  async createUploadedFile(
    d: CargoOwnerScope & {
      purpose: string;
      file: Blob;
      input: {
        id?: string;
        name: string;
        mimeType?: string;
        title?: string;
        expiresAt?: Date;
        authorization: ResourceAuthorization;
      };
    }
  ) {
    let mimeType = d.input.mimeType ?? d.file.type ?? 'application/octet-stream';
    let storeId = generatePlainId(20);

    await getStorage().putObject(getCargoFilesBucketName(), storeId, d.file, mimeType);

    let { file, input, ...scope } = d;

    return await this.createFile({
      ...scope,
      storeId,
      internal: {
        isReadOnly: true
      },
      input: {
        id: d.input.id,
        name: d.input.name,
        mimeType,
        size: d.file.size,
        title: d.input.title,
        expiresAt: d.input.expiresAt,
        authorization: d.input.authorization
      }
    });
  }

  async createUploadedFileFromByteStream(
    d: CargoOwnerScope & {
      purpose: string;
      content: AsyncIterable<Uint8Array>;
      input: {
        id?: string;
        name: string;
        mimeType?: string;
        title?: string;
        expiresAt?: Date;
        authorization: ResourceAuthorization;
      };
    }
  ) {
    let mimeType = d.input.mimeType ?? 'application/octet-stream';
    let storeId = generatePlainId(20);
    let chunks: Uint8Array[] = [];
    let size = 0;

    for await (let chunk of d.content) {
      chunks.push(chunk);
      size += chunk.byteLength;
    }

    await getStorage().putObject(
      getCargoFilesBucketName(),
      storeId,
      new Blob(chunks as any[]),
      mimeType
    );

    let { content, input, ...scope } = d;

    return await this.createFile({
      ...scope,
      storeId,
      internal: {
        isReadOnly: true
      },
      input: {
        id: d.input.id,
        name: d.input.name,
        mimeType,
        size,
        title: d.input.title,
        expiresAt: d.input.expiresAt,
        authorization: d.input.authorization
      }
    });
  }

  async updateFileExpiry(d: { file: Pick<File, 'id'>; expiresAt: Date }) {
    return await db.file.update({
      where: {
        id: d.file.id
      },
      data: {
        expiresAt: d.expiresAt
      },
      include
    });
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
    d: CargoOwnerScope & {
      fileId: string;
    } & FileAccessInput
  ) {
    let file = await db.file.findFirst({
      where: {
        ...cargoFileScope(d),
        id: d.fileId
      },
      include
    });

    if (!file) throw new ServiceError(notFoundError('file', d.fileId));

    if (d.authorization.resourceActor) {
      if (
        !d.authorization.resourceActor.organizationActorOid &&
        file.createdByResourceActorOid !== d.authorization.resourceActor.oid
      ) {
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
    let activeSkillAgentCount = await db.skillAgent.count({
      where: {
        status: 'active',
        document: {
          fileOid: d.file.oid
        }
      }
    });

    if (activeSkillAgentCount > 0) {
      throw new ServiceError(
        badRequestError({
          message: 'Cannot delete file: it is linked to an active skill agent'
        })
      );
    }

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

    let { file, document } = await withTransaction(async db => {
      let document = await db.document.findFirst({
        where: {
          fileOid: d.file.oid
        },
        select: {
          id: true
        }
      });

      let deletedFile = await db.file.update({
        where: {
          id: d.file.id
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

    if (document) {
      await internalDocumentDraftService.clearDocumentState(document.id);
    }

    return file;
  }

  async listFiles(
    d: {
      project: Project;
      instance: Instance;
      ids?: string[];
      purpose?: string[];
      storeIds?: string[];
      documentIds?: string[];
      fileLinkIds?: string[];
      fileReferenceIds?: string[];
      createdByActorIds?: string[];
      createdAt?: DateFilter;
      updatedAt?: DateFilter;
      expiresAt?: DateFilter;
      includeDeleted?: boolean;
    } & FileAccessInput
  ) {
    let files = await resolveFiles(d, d.ids);
    let purposes = await resolveFilePurposes(d, d.purpose);
    let stores = await resolveStores(d, d.storeIds);
    let documents = await resolveDocuments(d, d.documentIds);
    let fileLinks = await resolveFileLinks(d, d.fileLinkIds);
    let fileReferences = await resolveFileReferences(d, d.fileReferenceIds);
    let createdByActors = await resolveResourceActors(d, d.createdByActorIds);

    let where: Prisma.FileWhereInput = {
      instanceOid: d.instance.oid,
      status: d.includeDeleted ? undefined : 'active',
      isTemplateBacking: false,
      AND: [
        files ? { oid: files.in } : undefined!,
        purposes ? { purposeOid: purposes.in } : undefined!,
        stores
          ? {
              storeItems: {
                some: {
                  storeOid: stores.in
                }
              }
            }
          : undefined!,
        documents ? { document: { oid: documents.in } } : undefined!,
        fileLinks ? { links: { some: { oid: fileLinks.in } } } : undefined!,
        fileReferences
          ? {
              links: {
                some: {
                  references: {
                    some: {
                      oid: fileReferences.in
                    }
                  }
                }
              }
            }
          : undefined!,
        createdByActors ? { createdByResourceActorOid: createdByActors.in } : undefined!,
        d.createdAt ? { createdAt: normalizeDateFilter(d.createdAt) } : undefined!,
        d.updatedAt ? { updatedAt: normalizeDateFilter(d.updatedAt) } : undefined!,
        d.expiresAt ? { expiresAt: normalizeDateFilter(d.expiresAt) } : undefined!
      ].filter(Boolean)
    };

    if (d.authorization.type === 'privileged') {
      return Paginator.create(({ prisma }) =>
        prisma(
          async opts =>
            await Promise.all(
              (
                await db.file.findMany({
                  ...opts,
                  where,
                  include
                })
              ).map(async file => await this.withEffectiveStoreId(file))
            )
        )
      );
    }

    let access = await storeAccessService.listAccessibleStoreOidsForTenantEnvironment({
      project: d.project,
      instance: d.instance,
      authorization: d.authorization,
      defaultPermissions: d.defaultPermissions,
      overridePermissions: d.overridePermissions,
      requiredPermission: storeReadPermission
    });

    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await Promise.all(
            (
              await db.file.findMany({
                ...opts,
                where: {
                  ...where,
                  OR: [
                    {
                      createdByResourceActorOid: access.actor?.oid
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
