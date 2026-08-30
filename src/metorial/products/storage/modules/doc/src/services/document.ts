import {
  badRequestError,
  forbiddenError,
  notFoundError,
  ServiceError
} from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import { filePurposeService, fileService } from '@metorial/module-file';
import {
  storeAccessService,
  storeItemMutationService,
  storeReadPermission,
  storeWritePermission
} from '@metorial/module-store';
import type {
  Instance,
  Prisma,
  Project,
  ResourceActor,
  StoreCloneType,
  StoreParticipantPermissions
} from '@metorial/db';
import type { AuditScope } from '@metorial/audit-scope';
import type { Context } from '@metorial/context';
import { db, ID, withTransaction } from '@metorial/db';
import { Fabric } from '@metorial/fabric';
import {
  type DateFilter,
  normalizeDateFilter,
  resolveDocuments,
  resolveFiles,
  resolveResourceActors,
  resolveStores
} from '@metorial/list-utils';
import type { ResourceAuthorization } from '@metorial/module-access';
import { resourceActorPresentationInclude } from '@metorial/module-resource-actor';
import { internalDocumentContentService } from '../internal/documentContent';
import { internalDocumentContentStoreService } from '../internal/documentContentStore';
import type { DocumentDraft } from '../internal/documentDraft';
import {
  getDocumentDraftActors,
  internalDocumentDraftService,
  withDocumentDraftActor
} from '../internal/documentDraft';
import { internalDocumentParticipantService } from '../internal/documentParticipant';
import { internalDocumentVersioningService } from '../internal/documentVersioning';
import { rewriteDocumentMarkdownTitle } from '../lib/documentMarkdown';
import { documentFlushQueue } from '../queues/documentFlush';

let draftFlushDelayMs = 60 * 1000;
let documentMimeType = 'text/markdown';

export let documentInclude = {
  parentDocument: true,
  content: true,
  createdByResourceActor: {
    include: resourceActorPresentationInclude
  },
  currentVersion: {
    include: {
      content: true
    }
  },
  file: {
    include: {
      purpose: true,
      createdByResourceActor: {
        include: resourceActorPresentationInclude
      }
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
  project: Project;
  instance: Instance;
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
  authorization: ResourceAuthorization;
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

  private async getDocumentRecord(d: {
    project: Project;
    instance: Instance;
    documentId: string;
    includeDeleted?: boolean;
  }) {
    return await withTransaction(
      async db => {
        let document = await db.document.findFirst({
          where: {
            projectOid: d.project.oid,
            instanceOid: d.instance.oid,
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

  async createDocument(d: {
    project: Project;
    instance: Instance;
    auditScope: AuditScope;
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
      authorization: ResourceAuthorization;
      store?: {
        id: string;
        path: string;
      };
      defaultPermissions?: StoreParticipantPermissions[];
      overridePermissions?: boolean;
    };
  }) {
    let purpose = await filePurposeService.ensureDocumentFilePurpose();

    let actor = d.input.authorization.resourceActor;

    return await withTransaction(async db => {
      let documentId = d.input.id ?? (await ID.generateId('document'));

      let file = await fileService.createFile({
        project: d.project,
        instance: d.instance,
        auditScope: d.auditScope,
        purpose: purpose.id,
        storeId: d.input.fileStoreId ?? getDocumentStoreId(documentId),
        _isDocument: true,
        internal: d.internal,
        input: {
          name: d.input.title,
          mimeType: documentMimeType,
          size: getTextByteSize(d.input.content),
          title: d.input.title,
          authorization: d.input.authorization
        }
      });

      let content = await db.documentContent.create({
        data: {
          content: d.input.content
        }
      });

      let document = await db.document.create({
        data: {
          id: documentId,
          projectOid: d.project.oid,
          instanceOid: d.instance.oid,
          fileOid: file.oid,
          title: d.input.title,
          isReadOnly: d.internal?.isReadOnly ?? false,
          isTemplateBacking: d.internal?.isTemplateBacking ?? false,
          isContentOwner: true,
          maxVersionNumber: 1,
          contentOid: content.oid,
          createdByResourceActorOid: actor?.oid
        },
        include: documentInclude
      });

      let version = await internalDocumentVersioningService.createVersion({
        project: d.project,
        instance: d.instance,
        document,
        contentOid: content.oid,
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
          actor,
          context: d.auditScope.context
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
          project: d.project,
          instance: d.instance,
          storeId: d.input.store.id
        });

        await storeAccessService.assertStoreAccessForStore({
          project: d.project,
          instance: d.instance,
          store,
          authorization: d.input.authorization,
          defaultPermissions: d.input.defaultPermissions,
          overridePermissions: d.input.overridePermissions,
          requiredPermission: storeWritePermission
        });

        await storeItemMutationService.attachTargetToStore({
          project: d.project,
          instance: d.instance,
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

      await Fabric.fire('document.created:after', {
        auditScope: d.auditScope,
        document: createdDocument
      });

      return createdDocument;
    });
  }

  async getDocumentById(d: {
    project: Project;
    instance: Instance;
    documentId: string;
    includeDeleted?: boolean;
    authorization: ResourceAuthorization;
    defaultPermissions?: StoreParticipantPermissions[];
    overridePermissions?: boolean;
  }) {
    let document = await this.getDocumentRecord(d);
    let access = await storeAccessService.assertStoreAccessForDocument({
      project: d.project,
      instance: d.instance,
      document,
      authorization: d.authorization,
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

  async getDocumentPermissions(d: {
    project: Project;
    instance: Instance;
    document: {
      id: string;
      oid: bigint;
      fileOid: bigint;
      isReadOnly?: boolean;
      createdByResourceActorOid?: bigint | null;
    };
    authorization: ResourceAuthorization;
    defaultPermissions?: StoreParticipantPermissions[];
    overridePermissions?: boolean;
  }) {
    return await storeAccessService.getDocumentPermissions({
      project: d.project,
      instance: d.instance,
      document: d.document,
      authorization: d.authorization,
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
    let document = await db.document.findFirst({
      where: {
        id: d.documentId,
        file: d.includeDeleted ? undefined : { status: 'active' }
      },
      include: {
        ...documentInclude,
        instance: true,
        project: true
      }
    });

    if (!document) {
      throw new ServiceError(notFoundError('document', d.documentId));
    }

    return {
      project: document.project,
      instance: document.instance,
      document: await this.resolveDocument(document)
    } satisfies ScopedResolvedDocumentRecord;
  }

  async listDocuments(
    d: { project: Project; instance: Instance } & DocumentAccessInput & {
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
      projectOid: d.project.oid,
      instanceOid: d.instance.oid,
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

    if (d.authorization.type === 'privileged') {
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

  async updateDocument(d: {
    project: Project;
    instance: Instance;
    document: ResolvedDocumentRecord;
    input: {
      title?: string;
      content?: string;
      authorization: ResourceAuthorization;
      /**
       * Where the edit came from. Kept on the draft so it can be attributed when the
       * version that seals these edits is later audited.
       */
      context?: Context;
      defaultPermissions?: StoreParticipantPermissions[];
      overridePermissions?: boolean;
    };
  }) {
    if (d.input.title === undefined && d.input.content === undefined) {
      throw new ServiceError(
        badRequestError({
          message: 'At least one document field must be updated'
        })
      );
    }

    let access = await storeAccessService.assertStoreAccessForDocument({
      project: d.project,
      instance: d.instance,
      document: d.document,
      authorization: d.input.authorization,
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
          actors: currentDraft ? getDocumentDraftActors(currentDraft) : [],
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
          nextDraft.actors = withDocumentDraftActor(nextDraft, {
            id: actor.id,
            context: d.input.context
          });
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

  async cloneDocument(d: {
    project: Project;
    instance: Instance;
    auditScope: AuditScope;
    document: ResolvedDocumentRecord;
    input: {
      id?: string;
      title?: string;
      cloneType?: StoreCloneType;
      rewriteContentTitle?: boolean;
      authorization: ResourceAuthorization;
      creatorActor?: ResourceActor;
      defaultPermissions?: StoreParticipantPermissions[];
      overridePermissions?: boolean;
    };
  }) {
    let access = await storeAccessService.assertStoreAccessForDocument({
      project: d.project,
      instance: d.instance,
      document: d.document,
      authorization: d.input.authorization,
      defaultPermissions: d.input.defaultPermissions,
      overridePermissions: d.input.overridePermissions,
      requiredPermission: storeReadPermission
    });
    let creatorActor =
      d.input.creatorActor ?? d.input.authorization.resourceActor ?? access.actor;

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
      let documentId = d.input.id ?? (await ID.generateId('document'));
      let sourceTitle = d.document.resolvedTitle ?? d.document.title;
      let sourceContent = d.document.resolvedContent ?? d.document.content.content;
      let nextTitle = d.input.title ?? sourceTitle;
      let nextContent = d.input.rewriteContentTitle
        ? rewriteDocumentMarkdownTitle(sourceContent, nextTitle)
        : sourceContent;

      let file = await fileService.createFile({
        project: d.project,
        instance: d.instance,
        auditScope: d.auditScope,
        purpose: purpose.id,
        storeId: getDocumentStoreId(documentId),
        _isDocument: true,
        input: {
          name: nextTitle,
          mimeType: documentMimeType,
          size: getTextByteSize(nextContent),
          title: nextTitle,
          authorization: {
            type: 'privileged',
            resourceActor: creatorActor
          }
        }
      });

      let content =
        cloneType === 'duplicate'
          ? await db.documentContent.create({
              data: {
                content: nextContent
              }
            })
          : null;

      let document = await db.document.create({
        data: {
          id: documentId,
          projectOid: d.project.oid,
          instanceOid: d.instance.oid,
          fileOid: file.oid,
          title: nextTitle,
          isContentOwner: cloneType === 'duplicate',
          maxVersionNumber: 1,
          contentOid: cloneType === 'duplicate' ? content!.oid : d.document.contentOid,
          parentDocumentOid: cloneType === 'sync_until_change' ? d.document.oid : null,
          createdByResourceActorOid: creatorActor?.oid
        },
        include: documentInclude
      });

      let version = await internalDocumentVersioningService.createVersion({
        project: d.project,
        instance: d.instance,
        document,
        contentOid: cloneType === 'duplicate' ? content!.oid : d.document.contentOid,
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
          actor: creatorActor,
          context: d.auditScope.context
        });
      }

      await Fabric.fire('document.created:after', {
        auditScope: d.auditScope,
        document: nextDocument
      });

      return nextDocument;
    });

    return await this.withEffectiveFileStore(clonedDocument);
  }

  async deleteDocument(d: {
    project: Project;
    instance: Instance;
    auditScope: AuditScope;
    document: ResolvedDocumentRecord;
    authorization: ResourceAuthorization;
    defaultPermissions?: StoreParticipantPermissions[];
    overridePermissions?: boolean;
  }) {
    await storeAccessService.assertStoreAccessForDocument({
      project: d.project,
      instance: d.instance,
      document: d.document,
      authorization: d.authorization,
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
        file: d.document.file,
        auditScope: d.auditScope
      });

      return await this.getDocumentRecord({
        project: d.project,
        instance: d.instance,
        documentId: d.document.id,
        includeDeleted: true
      });
    });

    await Fabric.fire('document.deleted:after', {
      auditScope: d.auditScope,
      document: deletedDocument
    });

    return deletedDocument;
  }
}

export let documentService = Service.create(
  'cargoDocumentService',
  () => new DocumentServiceImpl()
).build();
