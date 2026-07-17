import {
  badRequestError,
  forbiddenError,
  notFoundError,
  ServiceError
} from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import { getId } from '@metorial/cargo-config/id';
import {
  type DateFilter,
  normalizeDateFilter,
  resolveDocuments,
  resolveFiles,
  resolveResourceActors,
  resolveStores
} from '@metorial/cargo-list-utils';
import type { ResourceScope } from '@metorial/module-resource-tenant';
import { filePurposeService, fileService } from '@metorial/cargo-module-file';
import { resourceActorService } from '@metorial/module-resource-tenant';
import {
  type StoreAccessInput,
  storeAccessService,
  storeItemMutationService,
  storeReadPermission,
  storeWritePermission
} from '@metorial/cargo-module-store';
import type { Prisma, StoreCloneType, StoreParticipantPermissions } from '@metorial/db';
import { db, withTransaction } from '@metorial/db';
import { internalDocumentContentService } from '../internal/documentContent';
import { internalDocumentContentStoreService } from '../internal/documentContentStore';
import type { DocumentDraft } from '../internal/documentDraft';
import { internalDocumentDraftService } from '../internal/documentDraft';
import { internalDocumentParticipantService } from '../internal/documentParticipant';
import { internalDocumentVersioningService } from '../internal/documentVersioning';
import { rewriteDocumentMarkdownTitle } from '../lib/documentMarkdown';
import { documentFlushQueue } from '../queues/documentFlush';

let draftFlushDelayMs = 60 * 1000;
let documentMimeType = 'text/markdown';

export let documentInclude = {
  parentDocument: true,
  content: true,
  createdByResourceActor: true,
  currentVersion: {
    include: {
      content: true
    }
  },
  file: {
    include: {
      purpose: true,
      createdByResourceActor: true
    }
  }
} satisfies Prisma.DocumentInclude;

export type ResolvedDocumentRecord = Prisma.DocumentGetPayload<{
  include: typeof documentInclude;
}> & {
  resolvedTitle?: string;
  resolvedContent?: string;
  hasDraft?: boolean;
  draftUpdatedAt?: Date;
  draftRevision?: number;
};

export type ScopedResolvedDocumentRecord = {
  resourceTenant: {
    id: string;
    oid: bigint;
  };
  resourceGroup: {
    id: string;
    oid: bigint;
  };
  document: ResolvedDocumentRecord;
};

type DocumentRecord = Prisma.DocumentGetPayload<{
  include: typeof documentInclude;
}>;
type DocumentWithEffectiveStoreId<T extends { file: { storeId: string } }> = T & {
  file: T['file'] & {
    effectiveStoreId?: string;
  };
};
type DocumentAccessInput = {
  actorId?: string;
  accessTags?: StoreAccessInput['accessTags'];
  defaultPermissions?: StoreParticipantPermissions[];
  overridePermissions?: boolean;
};

let getTextByteSize = (content: string) => new TextEncoder().encode(content).length;

let getDocumentStoreId = (documentId: string) => `document_${documentId}`;

class DocumentServiceImpl {
  private async queueDocumentFlush(documentId: string, delayMs = draftFlushDelayMs) {
    await documentFlushQueue.add(
      { documentId },
      {
        id: documentId,
        delay: Math.max(delayMs, 0)
      }
    );
  }

  private async getDocumentRecord(
    d: ResourceScope & {
      documentId: string;
      includeDeleted?: boolean;
    }
  ) {
    return await withTransaction(
      async db => {
        let document = await db.document.findFirst({
          where: {
            resourceTenantOid: d.resourceTenant.oid,
            resourceGroupOid: d.resourceGroup.oid,
            id: d.documentId,
            file: d.includeDeleted ? undefined : { status: 'active' }
          },
          include: documentInclude
        });

        if (!document) throw new ServiceError(notFoundError('document', d.documentId));

        return document;
      },
      { ifExists: true }
    );
  }

  private async resolveDocument(document: DocumentRecord): Promise<ResolvedDocumentRecord> {
    let draft = await internalDocumentDraftService.getDraftByDocumentId(document.id);
    if (!draft) return await this.withEffectiveFileStore(document);

    return await this.withEffectiveFileStore({
      ...document,
      resolvedTitle: draft.title,
      resolvedContent: draft.content,
      hasDraft: true,
      draftRevision: draft.revision,
      draftUpdatedAt: new Date(draft.updatedAt)
    });
  }

  private async withEffectiveFileStore<T extends DocumentRecord | ResolvedDocumentRecord>(
    document: T
  ) {
    let effectiveStoreSource =
      await internalDocumentContentStoreService.getEffectiveDocumentStoreSource(document);
    if (effectiveStoreSource.file.storeId === document.file.storeId) {
      return document as DocumentWithEffectiveStoreId<T>;
    }

    return {
      ...document,
      file: {
        ...document.file,
        effectiveStoreId: effectiveStoreSource.file.storeId
      }
    } satisfies DocumentWithEffectiveStoreId<T>;
  }

  private ensureDocumentActive(document: DocumentRecord) {
    if (document.file.status !== 'active') {
      throw new ServiceError(
        forbiddenError({
          message: 'Cannot perform this action on a deleted document'
        })
      );
    }
  }

  private assertDocumentWritable(document: Pick<DocumentRecord, 'id' | 'isReadOnly'>) {
    if (document.isReadOnly) {
      throw new ServiceError(
        forbiddenError({
          message: `Document ${document.id} is read-only`
        })
      );
    }
  }

  async createDocument(
    d: ResourceScope & {
      internal?: {
        isReadOnly?: boolean;
        isTemplateBacking?: boolean;
        allowReadOnlyStore?: boolean;
      };
      input: {
        id?: string;
        title: string;
        content: string;
        fileStoreId?: string | null;
        actorId?: string;
        accessTags?: StoreAccessInput['accessTags'];
        store?: {
          id: string;
          path: string;
        };
        defaultPermissions?: StoreParticipantPermissions[];
        overridePermissions?: boolean;
      };
    }
  ) {
    let purpose = await filePurposeService.ensureDocumentFilePurpose();

    let actor = d.input.actorId
      ? await resourceActorService.getActorById({
          resourceTenant: d.resourceTenant,
          actorId: d.input.actorId
        })
      : undefined;

    return await withTransaction(async db => {
      let documentIds = d.input.id
        ? { oid: getId('document').oid, id: d.input.id }
        : getId('document');
      let contentIds = getId('documentContent');

      let file = await fileService.createFile({
        resourceTenant: d.resourceTenant,
        resourceGroup: d.resourceGroup,
        purpose: purpose.id,
        storeId: d.input.fileStoreId ?? getDocumentStoreId(documentIds.id),
        _isDocument: true,
        internal: d.internal,
        input: {
          name: d.input.title,
          mimeType: documentMimeType,
          size: getTextByteSize(d.input.content),
          title: d.input.title,
          actorId: d.input.actorId
        }
      });

      await db.documentContent.create({
        data: {
          oid: contentIds.oid,
          content: d.input.content
        }
      });

      let document = await db.document.create({
        data: {
          oid: documentIds.oid,
          id: documentIds.id,
          resourceTenantOid: d.resourceTenant.oid,
          resourceGroupOid: d.resourceGroup.oid,
          fileOid: file.oid,
          title: d.input.title,
          isReadOnly: d.internal?.isReadOnly ?? false,
          isTemplateBacking: d.internal?.isTemplateBacking ?? false,
          isContentOwner: true,
          maxVersionNumber: 1,
          contentOid: contentIds.oid,
          createdByResourceActorOid: actor?.oid
        },
        include: documentInclude
      });

      let version = await internalDocumentVersioningService.createVersion({
        resourceTenant: d.resourceTenant,
        resourceGroup: d.resourceGroup,
        document,
        versionNumber: 1,
        contentOid: contentIds.oid,
        listEditedAt: new Date()
      });

      if (actor) {
        await internalDocumentParticipantService.ensureDocumentParticipant({
          document,
          actor,
          mode: 'edit'
        });

        await internalDocumentParticipantService.ensureVersionEditor({
          version,
          document,
          actor
        });
      }

      let createdDocument = await db.document.update({
        where: {
          id: document.id
        },
        data: {
          currentVersionOid: version.oid
        },
        include: documentInclude
      });

      if (d.input.store) {
        let store = await storeAccessService.getStoreById({
          resourceTenant: d.resourceTenant,
          resourceGroup: d.resourceGroup,
          storeId: d.input.store.id
        });

        await storeAccessService.assertStoreAccessForStore({
          resourceTenant: d.resourceTenant,
          resourceGroup: d.resourceGroup,
          store,
          actorId: d.input.actorId,
          accessTags: d.input.accessTags,
          defaultPermissions: d.input.defaultPermissions,
          overridePermissions: d.input.overridePermissions,
          requiredPermission: storeWritePermission
        });

        await storeItemMutationService.attachTargetToStore({
          resourceTenant: d.resourceTenant,
          resourceGroup: d.resourceGroup,
          store,
          path: d.input.store.path,
          target: {
            file: createdDocument.file,
            document: {
              oid: createdDocument.oid,
              id: createdDocument.id
            }
          },
          actor,
          allowReadOnly: d.internal?.allowReadOnlyStore
        });
      }

      return createdDocument;
    });
  }

  async getDocumentById(
    d: ResourceScope & {
      documentId: string;
      includeDeleted?: boolean;
      actorId?: string;
      accessTags?: StoreAccessInput['accessTags'];
      defaultPermissions?: StoreParticipantPermissions[];
      overridePermissions?: boolean;
    }
  ) {
    let document = await this.getDocumentRecord(d);
    let access = await storeAccessService.assertStoreAccessForDocument({
      resourceTenant: d.resourceTenant,
      resourceGroup: d.resourceGroup,
      document,
      actorId: d.actorId,
      accessTags: d.accessTags,
      defaultPermissions: d.defaultPermissions,
      overridePermissions: d.overridePermissions,
      requiredPermission: storeReadPermission
    });

    if (access.actor) {
      await withTransaction(async () => {
        await internalDocumentParticipantService.ensureDocumentParticipant({
          document,
          actor: access.actor!,
          mode: 'view'
        });
      });
    }

    return await this.resolveDocument(document);
  }

  async getDocumentPermissions(
    d: ResourceScope & {
      document: {
        id: string;
        oid: bigint;
        fileOid: bigint;
        isReadOnly?: boolean;
        createdByResourceActorOid?: bigint | null;
      };
      actorId?: string;
      accessTags?: StoreAccessInput['accessTags'];
      defaultPermissions?: StoreParticipantPermissions[];
      overridePermissions?: boolean;
    }
  ) {
    return await storeAccessService.getDocumentPermissions({
      resourceTenant: d.resourceTenant,
      resourceGroup: d.resourceGroup,
      document: d.document,
      actorId: d.actorId,
      accessTags: d.accessTags,
      defaultPermissions: d.defaultPermissions,
      overridePermissions: d.overridePermissions
    });
  }

  async getDocumentByFileId(d: { fileId: string }) {
    let document = await db.document.findFirst({
      where: {
        file: {
          id: d.fileId
        }
      },
      include: documentInclude
    });
    if (!document) return null;

    return await this.resolveDocument(document);
  }

  async getScopedDocumentById(d: { documentId: string; includeDeleted?: boolean }) {
    let scopedDocument = await db.document.findFirst({
      where: {
        id: d.documentId,
        file: d.includeDeleted ? undefined : { status: 'active' }
      },
      include: {
        ...documentInclude,
        resourceTenant: {
          select: {
            id: true,
            oid: true
          }
        },
        resourceGroup: {
          select: {
            id: true,
            oid: true
          }
        }
      }
    });

    if (!scopedDocument) {
      throw new ServiceError(notFoundError('document', d.documentId));
    }

    let { resourceTenant, resourceGroup, ...document } = scopedDocument;

    return {
      resourceTenant,
      resourceGroup,
      document: await this.resolveDocument(document)
    } satisfies ScopedResolvedDocumentRecord;
  }

  async listDocuments(
    d: ResourceScope &
      DocumentAccessInput & {
        ids?: string[];
        fileIds?: string[];
        storeIds?: string[];
        parentDocumentIds?: string[];
        createdByActorIds?: string[];
        createdAt?: DateFilter;
        updatedAt?: DateFilter;
      }
  ) {
    let documents = await resolveDocuments(d, d.ids);
    let files = await resolveFiles(d, d.fileIds);
    let stores = await resolveStores(d, d.storeIds);
    let parentDocuments = await resolveDocuments(d, d.parentDocumentIds);
    let createdByActors = await resolveResourceActors(d, d.createdByActorIds);

    let where: Prisma.DocumentWhereInput = {
      resourceTenantOid: d.resourceTenant.oid,
      resourceGroupOid: d.resourceGroup.oid,
      isTemplateBacking: false,
      file: {
        status: 'active'
      },
      AND: [
        documents ? { oid: documents.in } : undefined!,
        files ? { fileOid: files.in } : undefined!,
        stores
          ? {
              storeItems: {
                some: {
                  storeOid: stores.in
                }
              }
            }
          : undefined!,
        parentDocuments ? { parentDocumentOid: parentDocuments.in } : undefined!,
        createdByActors ? { createdByResourceActorOid: createdByActors.in } : undefined!,
        d.createdAt ? { createdAt: normalizeDateFilter(d.createdAt) } : undefined!,
        d.updatedAt ? { updatedAt: normalizeDateFilter(d.updatedAt) } : undefined!
      ].filter(Boolean)
    };

    if (!d.actorId) {
      return Paginator.create(({ prisma }) =>
        prisma(
          async opts =>
            await db.document.findMany({
              ...opts,
              where,
              include: documentInclude
            })
        )
      );
    }

    let access = await storeAccessService.listAccessibleStoreOidsForTenantEnvironment({
      resourceTenant: d.resourceTenant,
      resourceGroup: d.resourceGroup,
      actorId: d.actorId,
      accessTags: d.accessTags,
      defaultPermissions: d.defaultPermissions,
      overridePermissions: d.overridePermissions,
      requiredPermission: storeReadPermission
    });

    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.document.findMany({
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
            include: documentInclude
          })
      )
    );
  }

  async updateDocument(
    d: ResourceScope & {
      document: ResolvedDocumentRecord;
      input: {
        title?: string;
        content?: string;
        actorId?: string;
        accessTags?: StoreAccessInput['accessTags'];
        defaultPermissions?: StoreParticipantPermissions[];
        overridePermissions?: boolean;
      };
    }
  ) {
    if (d.input.title === undefined && d.input.content === undefined) {
      throw new ServiceError(
        badRequestError({
          message: 'At least one document field must be updated'
        })
      );
    }

    let access = await storeAccessService.assertStoreAccessForDocument({
      resourceTenant: d.resourceTenant,
      resourceGroup: d.resourceGroup,
      document: d.document,
      actorId: d.input.actorId,
      accessTags: d.input.accessTags,
      defaultPermissions: d.input.defaultPermissions,
      overridePermissions: d.input.overridePermissions,
      requiredPermission: storeWritePermission
    });

    let actor = access.actor;

    this.ensureDocumentActive(d.document);
    this.assertDocumentWritable(d.document);

    let resolved = await internalDocumentDraftService.withDocumentLock(
      d.document.id,
      async () => {
        let currentDraft = await internalDocumentDraftService.getDraftByDocumentId(
          d.document.id
        );
        let currentContent =
          currentDraft?.content ?? d.document.resolvedContent ?? d.document.content.content;
        let nextDraft: DocumentDraft = {
          documentId: d.document.id,
          title:
            d.input.title ??
            currentDraft?.title ??
            d.document.resolvedTitle ??
            d.document.title,
          content:
            d.input.content ??
            currentDraft?.content ??
            d.document.resolvedContent ??
            d.document.content.content,
          actorIds: currentDraft?.actorIds ?? [],
          revision: (currentDraft?.revision ?? 0) + 1,
          updatedAt: new Date().toISOString(),
          flushAfter: new Date(Date.now() + draftFlushDelayMs).toISOString()
        };
        let nextIsContentOwner = d.document.isContentOwner;

        if (
          d.input.content !== undefined &&
          currentContent !== nextDraft.content &&
          !d.document.isContentOwner
        ) {
          let { shouldKeepParentSync } =
            await internalDocumentContentService.getParentSyncState({
              document: d.document,
              nextContent: nextDraft.content
            });

          if (!shouldKeepParentSync) {
            await db.document.updateMany({
              where: {
                id: d.document.id,
                isContentOwner: false
              },
              data: {
                isContentOwner: true
              }
            });

            nextIsContentOwner = true;
          }
        }

        if (actor) {
          nextDraft.actorIds = [...new Set([...nextDraft.actorIds, actor.id])];
        }

        await internalDocumentDraftService.setDraft(nextDraft);
        await internalDocumentDraftService.markDocumentDirty(
          d.document.id,
          nextDraft.revision
        );

        return {
          ...d.document,
          isContentOwner: nextIsContentOwner,
          resolvedTitle: nextDraft.title,
          resolvedContent: nextDraft.content,
          hasDraft: true,
          draftRevision: nextDraft.revision,
          draftUpdatedAt: new Date(nextDraft.updatedAt)
        } satisfies ResolvedDocumentRecord;
      }
    );

    if (actor) {
      await withTransaction(async () => {
        await internalDocumentParticipantService.ensureDocumentParticipant({
          document: d.document,
          actor,
          mode: 'edit'
        });
      });
    }

    await this.queueDocumentFlush(d.document.id, draftFlushDelayMs);

    return await this.withEffectiveFileStore(resolved);
  }

  async cloneDocument(
    d: ResourceScope & {
      document: ResolvedDocumentRecord;
      input: {
        id?: string;
        title?: string;
        cloneType?: StoreCloneType;
        rewriteContentTitle?: boolean;
        actorId?: string;
        accessTags?: StoreAccessInput['accessTags'];
        creatorActorId?: string;
        defaultPermissions?: StoreParticipantPermissions[];
        overridePermissions?: boolean;
      };
    }
  ) {
    let access = await storeAccessService.assertStoreAccessForDocument({
      resourceTenant: d.resourceTenant,
      resourceGroup: d.resourceGroup,
      document: d.document,
      actorId: d.input.actorId,
      accessTags: d.input.accessTags,
      defaultPermissions: d.input.defaultPermissions,
      overridePermissions: d.input.overridePermissions,
      requiredPermission: storeReadPermission
    });
    let creatorActor = d.input.creatorActorId
      ? await resourceActorService.getActorById({
          resourceTenant: d.resourceTenant,
          actorId: d.input.creatorActorId
        })
      : access.actor;

    this.ensureDocumentActive(d.document);

    let purpose = await filePurposeService.ensureDocumentFilePurpose();
    let cloneType = d.input.cloneType ?? 'sync_until_change';
    if (d.input.rewriteContentTitle && cloneType !== 'duplicate') {
      throw new ServiceError(
        badRequestError({
          message: 'Document content titles can only be rewritten for duplicate clones'
        })
      );
    }

    let clonedDocument = await withTransaction(async db => {
      let documentIds = d.input.id
        ? { oid: getId('document').oid, id: d.input.id }
        : getId('document');
      let contentIds = getId('documentContent');
      let sourceTitle = d.document.resolvedTitle ?? d.document.title;
      let sourceContent = d.document.resolvedContent ?? d.document.content.content;
      let nextTitle = d.input.title ?? sourceTitle;
      let nextContent = d.input.rewriteContentTitle
        ? rewriteDocumentMarkdownTitle(sourceContent, nextTitle)
        : sourceContent;

      let file = await fileService.createFile({
        resourceTenant: d.resourceTenant,
        resourceGroup: d.resourceGroup,
        purpose: purpose.id,
        storeId: getDocumentStoreId(documentIds.id),
        _isDocument: true,
        input: {
          name: nextTitle,
          mimeType: documentMimeType,
          size: getTextByteSize(nextContent),
          title: nextTitle,
          actorId: creatorActor?.id
        }
      });

      if (cloneType === 'duplicate') {
        await db.documentContent.create({
          data: {
            oid: contentIds.oid,
            content: nextContent
          }
        });
      }

      let document = await db.document.create({
        data: {
          oid: documentIds.oid,
          id: documentIds.id,
          resourceTenantOid: d.resourceTenant.oid,
          resourceGroupOid: d.resourceGroup.oid,
          fileOid: file.oid,
          title: nextTitle,
          isContentOwner: cloneType === 'duplicate',
          maxVersionNumber: 1,
          contentOid: cloneType === 'duplicate' ? contentIds.oid : d.document.contentOid,
          parentDocumentOid: cloneType === 'sync_until_change' ? d.document.oid : null,
          createdByResourceActorOid: creatorActor?.oid
        },
        include: documentInclude
      });

      let version = await internalDocumentVersioningService.createVersion({
        resourceTenant: d.resourceTenant,
        resourceGroup: d.resourceGroup,
        document,
        versionNumber: 1,
        contentOid: cloneType === 'duplicate' ? contentIds.oid : d.document.contentOid,
        listEditedAt: new Date()
      });

      let nextDocument = await db.document.update({
        where: {
          id: document.id
        },
        data: {
          currentVersionOid: version.oid
        },
        include: documentInclude
      });

      if (creatorActor) {
        await internalDocumentParticipantService.ensureDocumentParticipant({
          document: nextDocument,
          actor: creatorActor,
          mode: 'edit'
        });

        await internalDocumentParticipantService.ensureVersionEditor({
          version,
          document: nextDocument,
          actor: creatorActor
        });
      }

      return nextDocument;
    });

    return await this.withEffectiveFileStore(clonedDocument);
  }

  async deleteDocument(
    d: ResourceScope & {
      document: ResolvedDocumentRecord;
      actorId?: string;
      accessTags?: StoreAccessInput['accessTags'];
      defaultPermissions?: StoreParticipantPermissions[];
      overridePermissions?: boolean;
    }
  ) {
    await storeAccessService.assertStoreAccessForDocument({
      resourceTenant: d.resourceTenant,
      resourceGroup: d.resourceGroup,
      document: d.document,
      actorId: d.actorId,
      accessTags: d.accessTags,
      defaultPermissions: d.defaultPermissions,
      overridePermissions: d.overridePermissions,
      requiredPermission: storeWritePermission
    });

    this.ensureDocumentActive(d.document);
    this.assertDocumentWritable(d.document);

    let activeSkillAgentCount = await db.skillAgent.count({
      where: {
        documentOid: d.document.oid,
        status: 'active'
      }
    });

    if (activeSkillAgentCount > 0) {
      throw new ServiceError(
        badRequestError({
          message: 'Cannot delete document: it is linked to an active skill agent'
        })
      );
    }

    let deletedDocument = await withTransaction(async db => {
      await fileService.deleteFile({
        file: d.document.file
      });

      let docWithTenant = await db.document.findFirstOrThrow({
        where: { oid: d.document.oid },
        include: {
          resourceTenant: true,
          resourceGroup: true
        }
      });

      return await this.getDocumentRecord({
        resourceTenant: docWithTenant.resourceTenant,
        resourceGroup: docWithTenant.resourceGroup,
        documentId: d.document.id,
        includeDeleted: true
      });
    });

    return deletedDocument;
  }
}

export let documentService = Service.create(
  'cargoDocumentService',
  () => new DocumentServiceImpl()
).build();
