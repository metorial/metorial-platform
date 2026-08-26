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
import { Fabric } from '@metorial/fabric';
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
import { PublicUrlPurpose } from 'object-storage-client';
import { fileFabricOwnerFromFile, fileFabricOwnerFromScope } from '../internal/fabric';
import { cargoFileScope, type CargoOwnerScope } from '../internal/ownerScope';
import { requireInstanceScope } from '../lib/instanceScope';
import { canDeleteDisplacedFile } from '../lib/fileReplacement';
import {
  getPendingFileContentFlushAfter,
  getStoredFileContent,
  shouldBufferFileContent
} from '../lib/pendingFileContent';
import {
  resolveUploadStreamDestination,
  type UploadStreamDestination
} from '../lib/uploadDestination';
import { uploadUrlExpirationSecs } from '../lib/uploadPolicy';
import { fileCleanupSingleQueue } from '../queues/fileCleanup';
import { getCargoFilesBucketName, getStorage } from '../storage';
import { documentFilePurposeSlug, filePurposeService } from './filePurpose';
import { fileReferenceService } from './fileReference';

export type { UploadStreamDestination };

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
  private async persistFileContent(
    fileOid: bigint,
    persistence:
      | { type: 'database'; content: Uint8Array<ArrayBuffer>; flushAfter: Date }
      | { type: 'object' }
      | undefined
  ) {
    if (!persistence) return;

    await withTransaction(async db => {
      if (persistence.type === 'object') {
        await db.filePendingContent.deleteMany({ where: { fileOid } });
        return;
      }

      await db.filePendingContent.upsert({
        where: { fileOid },
        create: {
          fileOid,
          content: persistence.content,
          flushAfter: persistence.flushAfter
        },
        update: {
          content: persistence.content,
          flushAfter: persistence.flushAfter,
          revision: { increment: 1 }
        }
      });
    });
  }

  private async deleteFileIfUnreferenced(d: { fileId: string; replacementFileOid: bigint }) {
    return await withTransaction(async db => {
      let file = await db.file.findUnique({
        where: { id: d.fileId },
        select: {
          oid: true,
          id: true,
          status: true,
          isInternal: true,
          isReadOnly: true,
          isTemplateBacking: true,
          fileSize: true,
          instanceOid: true,
          organizationOid: true,
          document: { select: { id: true } },
          links: {
            select: {
              _count: {
                select: {
                  references: true
                }
              }
            }
          },
          pendingContent: { select: { oid: true } },
          _count: {
            select: {
              storeItems: true,
              storeVersionItems: true,
              skillExports: true,
              skillExportRefs: true,
              skillImports: true,
              mergeRequestItemsAsBaseFile: true,
              mergeRequestItemsAsSourceFile: true,
              mergeRequestItemsAsTargetFile: true
            }
          }
        }
      });

      if (!file) return null;
      if (
        !canDeleteDisplacedFile({
          isSameFile: file.oid === d.replacementFileOid,
          status: file.status,
          isInternal: file.isInternal,
          isReadOnly: file.isReadOnly,
          isTemplateBacking: file.isTemplateBacking,
          hasDocument: !!file.document,
          fileLinkCount: file.links.length,
          hasFileReferences: file.links.some(link => link._count.references > 0),
          referenceCounts: file._count
        })
      )
        return null;

      let hadPendingContent = !!file.pendingContent;
      let deleted = await db.file.updateMany({
        where: {
          oid: file.oid,
          status: 'active'
        },
        data: {
          status: 'deleted',
          storeId: hadPendingContent ? '' : undefined
        }
      });
      if (deleted.count === 0) return null;

      await db.filePendingContent.deleteMany({
        where: { fileOid: file.oid }
      });

      await Fabric.fire('file.deleted:after', {
        ...fileFabricOwnerFromFile(file),
        file: file as File
      });

      return hadPendingContent ? null : file.id;
    });
  }

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
        contentPersistence?:
          | { type: 'database'; content: Uint8Array<ArrayBuffer>; flushAfter: Date }
          | { type: 'object' };
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
          replace?: boolean;
        };
        defaultPermissions?: StoreParticipantPermissions[];
        overridePermissions?: boolean;
      };
    }
  ): Promise<FileRecord> {
    let cleanupFileId: string | null = null;
    let result = await withTransaction(async db => {
      let fileName = d.input.name?.trim();
      if (!fileName) {
        throw new ServiceError(
          badRequestError({
            message: 'File name is required'
          })
        );
      }

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
            fileName,
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
        await this.persistFileContent(updatedFile.oid, d.internal?.contentPersistence);

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

          let attached = await storeItemMutationService.attachTargetToStore({
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
          if (d.input.store.replace && attached.previousFile) {
            cleanupFileId = await this.deleteFileIfUnreferenced({
              fileId: attached.previousFile.id,
              replacementFileOid: updatedFile.oid
            });
          }
        }

        return await this.withEffectiveStoreId(updatedFile);
      }

      await Fabric.fire('file.created:before', fileFabricOwnerFromScope(d, d.input.size));

      let createdFile = await db.file.create({
        data: {
          id: d.input.id ?? (await ID.generateId('file')),
          ...cargoFileScope(d),
          purposeOid: purpose.oid,
          storeId: d.storeId,
          fileName,
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
      await this.persistFileContent(createdFile.oid, d.internal?.contentPersistence);

      await Fabric.fire('file.created:after', {
        ...fileFabricOwnerFromScope(d, createdFile.fileSize),
        file: createdFile
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

        let attached = await storeItemMutationService.attachTargetToStore({
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
        if (d.input.store.replace && attached.previousFile) {
          cleanupFileId = await this.deleteFileIfUnreferenced({
            fileId: attached.previousFile.id,
            replacementFileOid: createdFile.oid
          });
        }
      }

      return await this.withEffectiveStoreId(createdFile);
    });

    if (cleanupFileId) {
      await fileCleanupSingleQueue.add(
        { fileId: cleanupFileId },
        { id: `file-cleanup:${cleanupFileId}` }
      );
    }

    return result;
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
    file: Pick<File, 'oid' | 'status' | 'storeId'> & { effectiveStoreId?: string };
  }) {
    await this.ensureFileActive(d.file);

    let object = await getStoredFileContent({
      file: {
        oid: d.file.oid,
        storeId: d.file.effectiveStoreId ?? d.file.storeId
      }
    });

    return await this.objectDataToBuffer(object.data);
  }

  /**
   * Says where a file's content lives, without reading it if it is in object
   * storage.
   *
   * Callers that only need to move content somewhere else -- a skill sync
   * copying an asset into a code bucket, say -- can use the returned bucket and
   * key to have the storage layer copy it server-side, so an arbitrarily large
   * file never enters this process. Small text files are still buffered in the
   * database before their first flush, and those are returned inline; they are
   * bounded by `maxBufferedFileSize`.
   */
  async resolveFileContentSource(d: {
    file: Pick<File, 'oid' | 'status' | 'storeId'> & { effectiveStoreId?: string };
  }): Promise<
    | { type: 'object'; bucket: string; key: string }
    | { type: 'inline'; content: Buffer }
  > {
    await this.ensureFileActive(d.file);

    let pending = await db.filePendingContent.findUnique({
      where: { fileOid: d.file.oid },
      select: { content: true }
    });

    if (pending) {
      return { type: 'inline', content: Buffer.from(pending.content) };
    }

    return {
      type: 'object',
      bucket: getCargoFilesBucketName(),
      key: d.file.effectiveStoreId ?? d.file.storeId
    };
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
    let bufferContent = shouldBufferFileContent({
      fileName: d.input.name,
      size: d.file.size
    });

    if (!bufferContent) {
      await getStorage().putObject(getCargoFilesBucketName(), storeId, d.file, mimeType);
    }

    let { file, input, ...scope } = d;

    return await this.createFile({
      ...scope,
      storeId,
      internal: {
        isReadOnly: true,
        contentPersistence: bufferContent
          ? {
              type: 'database',
              content: new Uint8Array(await d.file.arrayBuffer()),
              flushAfter: getPendingFileContentFlushAfter()
            }
          : { type: 'object' }
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

  /**
   * Reserves an object storage slot that a remote producer can write directly.
   *
   * This exists for content generated by another service -- a code-bucket zip
   * export, for example -- where routing the bytes through this process would
   * mean buffering an arbitrarily large archive. The producer writes to
   * `destination`, then the caller finishes with
   * {@link completePendingUploadForStream}.
   */
  async createPendingUploadForStream(): Promise<{
    storeId: string;
    destination: UploadStreamDestination;
  }> {
    let storeId = generatePlainId(20);
    let bucket = getCargoFilesBucketName();

    let destination = await resolveUploadStreamDestination({
      bucket,
      key: storeId,
      presign: async () => {
        let res = await getStorage().getPublicURL(
          bucket,
          storeId,
          uploadUrlExpirationSecs,
          PublicUrlPurpose.Upload
        );

        return res.url;
      }
    });

    return { storeId, destination };
  }

  /**
   * Creates the file record for an object a producer has already written.
   *
   * Unlike the regular upload completion, the size is read from the object
   * rather than compared against a declared one: generated content has no size
   * known up front.
   */
  async completePendingUploadForStream(
    d: CargoOwnerScope & {
      purpose: string;
      storeId: string;
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

    let object = await getStorage()
      .headObject(getCargoFilesBucketName(), d.storeId)
      .catch(() => null);

    if (!object) {
      throw new ServiceError(
        badRequestError({
          message: `No content was uploaded for ${d.input.name}`
        })
      );
    }

    let { storeId, input, ...scope } = d;

    return await this.createFile({
      ...scope,
      storeId,
      internal: {
        isReadOnly: true,
        contentPersistence: { type: 'object' }
      },
      input: {
        id: d.input.id,
        name: d.input.name,
        mimeType,
        size: object.size,
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

    let blob = new Blob(chunks as any[]);
    let bufferContent = shouldBufferFileContent({
      fileName: d.input.name,
      size
    });
    if (!bufferContent) {
      await getStorage().putObject(getCargoFilesBucketName(), storeId, blob, mimeType);
    }

    let { content, input, ...scope } = d;

    return await this.createFile({
      ...scope,
      storeId,
      internal: {
        isReadOnly: true,
        contentPersistence: bufferContent
          ? {
              type: 'database',
              content: new Uint8Array(await blob.arrayBuffer()),
              flushAfter: getPendingFileContentFlushAfter()
            }
          : { type: 'object' }
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
      let pendingContent = await db.filePendingContent.findUnique({
        where: { fileOid: d.file.oid },
        select: { oid: true }
      });

      let deletedFile = await db.file.update({
        where: {
          id: d.file.id
        },
        data: {
          status: 'deleted',
          storeId: pendingContent ? '' : undefined
        },
        include
      });
      await db.filePendingContent.deleteMany({
        where: { fileOid: d.file.oid }
      });

      return {
        file: deletedFile,
        document
      };
    });

    if (document) {
      await internalDocumentDraftService.clearDocumentState(document.id);
    }

    await Fabric.fire('file.deleted:after', {
      ...fileFabricOwnerFromFile(file),
      file
    });

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
