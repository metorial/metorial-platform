import {
  badRequestError,
  forbiddenError,
  notFoundError,
  ServiceError
} from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import type {
  Document,
  DocumentParticipantRole,
  Prisma,
  PrismaClient,
  StoreParticipantPermissions,
  TenantActor
} from '../../prisma/generated/client';
import { db } from '../db';
import { getId } from '../id';
import { documentFlushQueue } from '../queues/documentFlush';
import { actorService } from './actor';
import { documentDraftService, type DocumentDraft } from './documentDraft';
import { fileService } from './file';
import { filePurposeService, type CargoTenantEnvironment } from './filePurpose';
import { storeAccessService, storeReadPermission, storeWritePermission } from './storeAccess';
import { storeItemMutationService } from './storeItemMutation';

let activeVersionWindowMs = 3 * 60 * 60 * 1000;
let draftFlushDelayMs = 60 * 1000;
let documentMimeType = 'text/markdown';

export let documentInclude = {
  parentDocument: true,
  content: true,
  currentVersion: {
    include: {
      content: true
    }
  },
  file: {
    include: {
      purpose: true
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

type TransactionClient = Prisma.TransactionClient;
type DocumentRecord = Prisma.DocumentGetPayload<{
  include: typeof documentInclude;
}>;
type DocumentAccessInput = {
  actorId?: string;
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
    client: PrismaClient | TransactionClient,
    d: CargoTenantEnvironment & {
      documentId: string;
      includeDeleted?: boolean;
    }
  ) {
    let document = await client.document.findFirst({
      where: {
        tenantOid: d.tenant.oid,
        environmentOid: d.environment.oid,
        id: d.documentId,
        ...(d.includeDeleted ? {} : { file: { status: 'active' } })
      },
      include: documentInclude
    });

    if (!document) throw new ServiceError(notFoundError('document', d.documentId));

    return document;
  }

  private async resolveDocument(document: DocumentRecord): Promise<ResolvedDocumentRecord> {
    let draft = await documentDraftService.getDraftByDocumentId(document.id);
    if (!draft) return document;

    return {
      ...document,
      resolvedTitle: draft.title,
      resolvedContent: draft.content,
      hasDraft: true,
      draftRevision: draft.revision,
      draftUpdatedAt: new Date(draft.updatedAt)
    };
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

  private async upsertParticipant(
    tx: TransactionClient,
    d: {
      document: { oid: bigint };
      actor: { oid: bigint };
      mode: 'view' | 'edit';
    }
  ) {
    let now = new Date();
    let existing = await tx.documentParticipant.findFirst({
      where: {
        documentOid: d.document.oid,
        tenantActorOid: d.actor.oid
      }
    });

    let role: DocumentParticipantRole =
      d.mode === 'edit' || existing?.role === 'editor' ? 'editor' : 'viewer';

    if (existing) {
      return await tx.documentParticipant.update({
        where: {
          id: existing.id
        },
        data: {
          role,
          lastViewedAt: now,
          ...(d.mode === 'edit'
            ? {
                lastEditedAt: now
              }
            : {})
        }
      });
    }

    let generated = getId('documentParticipant');

    return await tx.documentParticipant.create({
      data: {
        oid: generated.oid,
        id: generated.id,
        role,
        documentOid: d.document.oid,
        tenantActorOid: d.actor.oid,
        lastViewedAt: now,
        ...(d.mode === 'edit'
          ? {
              lastEditedAt: now
            }
          : {})
      }
    });
  }

  async ensureDocumentParticipant(d: {
    document: { oid: bigint };
    actor: { oid: bigint };
    mode: 'view' | 'edit';
    client?: TransactionClient;
  }) {
    if (d.client) {
      return await this.upsertParticipant(d.client, d);
    }

    return await db.$transaction(async tx => await this.upsertParticipant(tx, d));
  }

  async materializeDocumentParticipantsFromStores(d: {
    document: Document;
    client?: TransactionClient;
  }) {
    let client = d.client ?? db;
    let storeActors = await storeAccessService.listStoreParticipantActorsForDocument({
      document: d.document,
      client
    });

    if (d.document.createdByTenantActorOid) {
      let creator = await client.tenantActor.findFirst({
        where: {
          oid: d.document.createdByTenantActorOid
        }
      });

      if (creator) {
        storeActors.push({
          actor: creator,
          mode: 'edit'
        });
      }
    }

    let actorsById = new Map<
      bigint,
      {
        actor: TenantActor;
        mode: 'view' | 'edit';
      }
    >();

    for (let item of storeActors) {
      let existing = actorsById.get(item.actor.oid);
      if (existing?.mode === 'edit') continue;

      actorsById.set(item.actor.oid, {
        actor: item.actor,
        mode: item.mode === 'edit' ? 'edit' : 'view'
      });
    }

    if (!d.client) {
      return await db.$transaction(async transactionClient => {
        for (let item of actorsById.values()) {
          await this.upsertParticipant(transactionClient, {
            document: d.document,
            actor: item.actor,
            mode: item.mode
          });
        }
      });
    }

    for (let item of actorsById.values()) {
      await this.upsertParticipant(d.client, {
        document: d.document,
        actor: item.actor,
        mode: item.mode
      });
    }
  }

  private async ensureVersionEditor(
    tx: TransactionClient,
    d: {
      version: { oid: bigint };
      document: { oid: bigint };
      actor: { oid: bigint };
    }
  ) {
    let existing = await tx.documentVersionEditors.findFirst({
      where: {
        documentVersionOid: d.version.oid,
        tenantActorOid: d.actor.oid
      }
    });

    if (existing) return existing;

    let generated = getId('documentVersionEditor');

    await tx.documentParticipant.updateMany({
      where: {
        documentOid: d.document.oid,
        tenantActorOid: d.actor.oid
      },
      data: {
        editCount: {
          increment: 1
        }
      }
    });

    return await tx.documentVersionEditors.create({
      data: {
        oid: generated.oid,
        id: generated.id,
        documentVersionOid: d.version.oid,
        tenantActorOid: d.actor.oid
      }
    });
  }

  private async createVersion(
    tx: TransactionClient,
    d: CargoTenantEnvironment & {
      document: { oid: bigint };
      versionNumber: number;
      contentOid: bigint;
      previousVersionOid?: bigint | null;
      listEditedAt?: Date;
    }
  ) {
    let generated = getId('documentVersion');

    return await tx.documentVersion.create({
      data: {
        oid: generated.oid,
        id: generated.id,
        tenantOid: d.tenant.oid,
        environmentOid: d.environment.oid,
        documentOid: d.document.oid,
        versionNumber: d.versionNumber,
        contentOid: d.contentOid,
        previousVersionOid: d.previousVersionOid ?? null,
        listEditedAt: d.listEditedAt
      },
      include: {
        content: true
      }
    });
  }

  private async writeDocumentContent(
    tx: TransactionClient,
    d: CargoTenantEnvironment & {
      document: DocumentRecord;
      nextContent: string;
      listEditedAt?: Date;
    }
  ) {
    let now = new Date();
    let shouldCreateNewVersion =
      !d.document.currentVersion ||
      now.getTime() - d.document.currentVersion.createdAt.getTime() >= activeVersionWindowMs;

    let liveContentOid = d.document.contentOid;
    let activeVersion = d.document.currentVersion;
    let nextVersionNumber = d.document.maxVersionNumber;

    if (shouldCreateNewVersion) {
      if (d.document.currentVersion) {
        let retiredContentIds = getId('documentContent');

        await tx.documentContent.create({
          data: {
            oid: retiredContentIds.oid,
            content: d.document.content.content
          }
        });

        await tx.documentVersion.update({
          where: {
            id: d.document.currentVersion.id
          },
          data: {
            contentOid: retiredContentIds.oid
          }
        });
      }

      if (d.document.isContentOwner) {
        await tx.documentContent.update({
          where: {
            oid: d.document.contentOid
          },
          data: {
            content: d.nextContent
          }
        });
      } else {
        let liveContentIds = getId('documentContent');

        await tx.documentContent.create({
          data: {
            oid: liveContentIds.oid,
            content: d.nextContent
          }
        });

        liveContentOid = liveContentIds.oid;
      }

      nextVersionNumber += 1;

      activeVersion = await this.createVersion(tx, {
        tenant: d.tenant,
        environment: d.environment,
        document: d.document,
        versionNumber: nextVersionNumber,
        contentOid: liveContentOid,
        previousVersionOid: d.document.currentVersion?.oid,
        listEditedAt: d.listEditedAt
      });
    } else if (d.document.isContentOwner) {
      await tx.documentContent.update({
        where: {
          oid: d.document.contentOid
        },
        data: {
          content: d.nextContent
        }
      });
    } else {
      let liveContentIds = getId('documentContent');

      await tx.documentContent.create({
        data: {
          oid: liveContentIds.oid,
          content: d.nextContent
        }
      });

      liveContentOid = liveContentIds.oid;

      if (!d.document.currentVersion) {
        activeVersion = await this.createVersion(tx, {
          tenant: d.tenant,
          environment: d.environment,
          document: d.document,
          versionNumber: d.document.maxVersionNumber + 1,
          contentOid: liveContentOid,
          listEditedAt: d.listEditedAt
        });

        nextVersionNumber += 1;
      } else {
        activeVersion = await tx.documentVersion.update({
          where: {
            id: d.document.currentVersion.id
          },
          data: {
            contentOid: liveContentOid,
            listEditedAt: d.listEditedAt
          },
          include: {
            content: true
          }
        });
      }
    }

    return {
      activeVersion,
      liveContentOid,
      nextVersionNumber,
      isContentOwner: true
    };
  }

  private async persistDraftToDocument(
    tx: TransactionClient,
    d: CargoTenantEnvironment & {
      document: DocumentRecord;
      draft: DocumentDraft;
      actors: TenantActor[];
    }
  ) {
    let nextTitle = d.draft.title;
    let nextContent = d.draft.content;
    let hasContentChange = nextContent !== d.document.content.content;
    let hasTitleChange = nextTitle !== d.document.title;

    if (!hasContentChange && !hasTitleChange) {
      return d.document;
    }

    let activeVersion = d.document.currentVersion;
    let liveContentOid = d.document.contentOid;
    let maxVersionNumber = d.document.maxVersionNumber;
    let isContentOwner = d.document.isContentOwner;

    if (hasContentChange) {
      let listEditedAt = new Date();

      let writeResult = await this.writeDocumentContent(tx, {
        tenant: d.tenant,
        environment: d.environment,
        document: d.document,
        nextContent,
        listEditedAt
      });

      activeVersion = writeResult.activeVersion;
      liveContentOid = writeResult.liveContentOid;
      maxVersionNumber = writeResult.nextVersionNumber;
      isContentOwner = writeResult.isContentOwner;
    }

    await tx.file.update({
      where: {
        id: d.document.file.id
      },
      data: {
        fileName: nextTitle,
        title: nextTitle,
        ...(hasContentChange
          ? {
              fileSize: getTextByteSize(nextContent)
            }
          : {})
      }
    });

    let updatedDocument = await tx.document.update({
      where: {
        id: d.document.id
      },
      data: {
        title: nextTitle,
        ...(hasContentChange
          ? {
              contentOid: liveContentOid,
              isContentOwner,
              maxVersionNumber,
              currentVersionOid: activeVersion?.oid ?? null
            }
          : {})
      },
      include: documentInclude
    });

    for (let actor of d.actors) {
      if (hasContentChange && activeVersion) {
        await this.ensureVersionEditor(tx, {
          version: activeVersion,
          document: updatedDocument,
          actor
        });
      }
    }

    return updatedDocument;
  }

  async createDocument(
    d: CargoTenantEnvironment & {
      input: {
        id?: string;
        title: string;
        content: string;
        actorId?: string;
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
      ? await actorService.getActorById({
          tenant: d.tenant,
          actorId: d.input.actorId
        })
      : undefined;

    return await db.$transaction(async tx => {
      let documentIds = d.input.id
        ? { oid: getId('document').oid, id: d.input.id }
        : getId('document');
      let contentIds = getId('documentContent');

      let file = await fileService.createFile({
        tenant: d.tenant,
        environment: d.environment,
        purpose: purpose.id,
        storeId: getDocumentStoreId(documentIds.id),
        _isDocument: true,
        client: tx,
        input: {
          name: d.input.title,
          mimeType: documentMimeType,
          size: getTextByteSize(d.input.content),
          title: d.input.title
        }
      });

      await tx.documentContent.create({
        data: {
          oid: contentIds.oid,
          content: d.input.content
        }
      });

      let document = await tx.document.create({
        data: {
          oid: documentIds.oid,
          id: documentIds.id,
          tenantOid: d.tenant.oid,
          environmentOid: d.environment.oid,
          fileOid: file.oid,
          title: d.input.title,
          isContentOwner: true,
          maxVersionNumber: 1,
          contentOid: contentIds.oid,
          createdByTenantActorOid: actor?.oid
        },
        include: documentInclude
      });

      let version = await this.createVersion(tx, {
        tenant: d.tenant,
        environment: d.environment,
        document,
        versionNumber: 1,
        contentOid: contentIds.oid,
        listEditedAt: new Date()
      });

      if (actor) {
        await this.upsertParticipant(tx, {
          document,
          actor,
          mode: 'edit'
        });

        await this.ensureVersionEditor(tx, {
          version,
          document,
          actor
        });
      }

      let createdDocument = await tx.document.update({
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
          tenant: d.tenant,
          environment: d.environment,
          storeId: d.input.store.id,
          client: tx
        });

        await storeAccessService.assertStoreAccessForStore({
          tenant: d.tenant,
          environment: d.environment,
          store,
          actorId: d.input.actorId,
          defaultPermissions: d.input.defaultPermissions,
          overridePermissions: d.input.overridePermissions,
          requiredPermission: storeWritePermission,
          client: tx
        });

        await storeItemMutationService.attachTargetToStore({
          tenant: d.tenant,
          environment: d.environment,
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
          client: tx
        });
      }

      return createdDocument;
    });
  }

  async getDocumentById(
    d: CargoTenantEnvironment & {
      documentId: string;
      includeDeleted?: boolean;
      actorId?: string;
      defaultPermissions?: StoreParticipantPermissions[];
      overridePermissions?: boolean;
    }
  ) {
    let document = await this.getDocumentRecord(db, d);
    let access = await storeAccessService.assertStoreAccessForDocument({
      tenant: d.tenant,
      environment: d.environment,
      document,
      actorId: d.actorId,
      defaultPermissions: d.defaultPermissions,
      overridePermissions: d.overridePermissions,
      requiredPermission: storeReadPermission
    });

    if (access.actor) {
      await db.$transaction(async tx => {
        await this.upsertParticipant(tx, {
          document,
          actor: access.actor!,
          mode: 'view'
        });
      });
    }

    return await this.resolveDocument(document);
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

  async listDocuments(d: CargoTenantEnvironment & DocumentAccessInput) {
    if (!d.actorId) {
      return Paginator.create(({ prisma }) =>
        prisma(
          async opts =>
            await db.document.findMany({
              ...opts,
              where: {
                tenantOid: d.tenant.oid,
                environmentOid: d.environment.oid,
                file: {
                  status: 'active'
                }
              },
              include: documentInclude
            })
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
      prisma(
        async opts =>
          await db.document.findMany({
            ...opts,
            where: {
              tenantOid: d.tenant.oid,
              environmentOid: d.environment.oid,
              file: {
                status: 'active'
              },
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
            include: documentInclude
          })
      )
    );
  }

  async updateDocument(
    d: CargoTenantEnvironment & {
      document: ResolvedDocumentRecord;
      input: {
        title?: string;
        content?: string;
        actorId?: string;
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
      tenant: d.tenant,
      environment: d.environment,
      document: d.document,
      actorId: d.input.actorId,
      defaultPermissions: d.input.defaultPermissions,
      overridePermissions: d.input.overridePermissions,
      requiredPermission: storeWritePermission
    });

    let actor = access.actor;

    this.ensureDocumentActive(d.document);

    let resolved = await documentDraftService.withDocumentLock(d.document.id, async () => {
      let currentDraft = await documentDraftService.getDraftByDocumentId(d.document.id);
      let nextDraft: DocumentDraft = {
        documentId: d.document.id,
        title:
          d.input.title ?? currentDraft?.title ?? d.document.resolvedTitle ?? d.document.title,
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

      if (actor) {
        nextDraft.actorIds = [...new Set([...nextDraft.actorIds, actor.id])];
      }

      await documentDraftService.setDraft(nextDraft);

      return {
        ...d.document,
        resolvedTitle: nextDraft.title,
        resolvedContent: nextDraft.content,
        hasDraft: true,
        draftRevision: nextDraft.revision,
        draftUpdatedAt: new Date(nextDraft.updatedAt)
      } satisfies ResolvedDocumentRecord;
    });

    if (actor) {
      await db.$transaction(async tx => {
        await this.upsertParticipant(tx, {
          document: d.document,
          actor,
          mode: 'edit'
        });
      });
    }

    await this.queueDocumentFlush(d.document.id, draftFlushDelayMs);

    return resolved;
  }

  async flushDocumentDraft(d: { documentId: string; force?: boolean }) {
    return await documentDraftService.withDocumentLock(d.documentId, async () => {
      let draft = await documentDraftService.getDraftByDocumentId(d.documentId);
      if (!draft) return null;

      let flushAfterMs = new Date(draft.flushAfter).getTime();
      if (!d.force && flushAfterMs > Date.now()) {
        await this.queueDocumentFlush(d.documentId, flushAfterMs - Date.now());
        return null;
      }

      let document = await db.$transaction(async tx => {
        let currentDocument = await tx.document.findFirst({
          where: {
            id: d.documentId
          },
          include: {
            ...documentInclude,
            tenant: true,
            environment: true
          }
        });
        if (!currentDocument) {
          throw new ServiceError(notFoundError('document', d.documentId));
        }
        this.ensureDocumentActive(currentDocument);

        let actors =
          draft.actorIds.length > 0
            ? await tx.tenantActor.findMany({
                where: {
                  tenantOid: currentDocument.tenantOid,
                  id: {
                    in: draft.actorIds
                  }
                }
              })
            : [];

        return await this.persistDraftToDocument(tx, {
          tenant: currentDocument.tenant,
          environment: currentDocument.environment,
          document: currentDocument,
          draft,
          actors
        });
      });

      await documentDraftService.deleteDraft(d.documentId);

      return await this.resolveDocument(document);
    });
  }

  async cloneDocument(
    d: CargoTenantEnvironment & {
      document: ResolvedDocumentRecord;
      input: {
        id?: string;
        title?: string;
        actorId?: string;
        defaultPermissions?: StoreParticipantPermissions[];
        overridePermissions?: boolean;
      };
    }
  ) {
    let access = await storeAccessService.assertStoreAccessForDocument({
      tenant: d.tenant,
      environment: d.environment,
      document: d.document,
      actorId: d.input.actorId,
      defaultPermissions: d.input.defaultPermissions,
      overridePermissions: d.input.overridePermissions,
      requiredPermission: storeReadPermission
    });
    let actor = access.actor;

    this.ensureDocumentActive(d.document);

    let purpose = await filePurposeService.ensureDocumentFilePurpose();

    return await db.$transaction(async tx => {
      let documentIds = d.input.id
        ? { oid: getId('document').oid, id: d.input.id }
        : getId('document');
      let sourceTitle = d.document.resolvedTitle ?? d.document.title;
      let sourceContent = d.document.resolvedContent ?? d.document.content.content;
      let nextTitle = d.input.title ?? sourceTitle;

      let file = await fileService.createFile({
        tenant: d.tenant,
        environment: d.environment,
        purpose: purpose.id,
        storeId: getDocumentStoreId(documentIds.id),
        _isDocument: true,
        client: tx,
        input: {
          name: nextTitle,
          mimeType: documentMimeType,
          size: getTextByteSize(sourceContent),
          title: nextTitle
        }
      });

      let document = await tx.document.create({
        data: {
          oid: documentIds.oid,
          id: documentIds.id,
          tenantOid: d.tenant.oid,
          environmentOid: d.environment.oid,
          fileOid: file.oid,
          title: nextTitle,
          isContentOwner: false,
          maxVersionNumber: 1,
          contentOid: d.document.contentOid,
          parentDocumentOid: d.document.oid,
          createdByTenantActorOid: actor?.oid
        },
        include: documentInclude
      });

      let version = await this.createVersion(tx, {
        tenant: d.tenant,
        environment: d.environment,
        document,
        versionNumber: 1,
        contentOid: d.document.contentOid,
        listEditedAt: new Date()
      });

      let clonedDocument = await tx.document.update({
        where: {
          id: document.id
        },
        data: {
          currentVersionOid: version.oid
        },
        include: documentInclude
      });

      if (actor) {
        await this.upsertParticipant(tx, {
          document: clonedDocument,
          actor,
          mode: 'edit'
        });

        await this.ensureVersionEditor(tx, {
          version,
          document: clonedDocument,
          actor
        });
      }

      return clonedDocument;
    });
  }

  async deleteDocument(
    d: CargoTenantEnvironment & {
      document: ResolvedDocumentRecord;
      actorId?: string;
      defaultPermissions?: StoreParticipantPermissions[];
      overridePermissions?: boolean;
    }
  ) {
    await storeAccessService.assertStoreAccessForDocument({
      tenant: d.tenant,
      environment: d.environment,
      document: d.document,
      actorId: d.actorId,
      defaultPermissions: d.defaultPermissions,
      overridePermissions: d.overridePermissions,
      requiredPermission: storeWritePermission
    });

    this.ensureDocumentActive(d.document);

    let deletedDocument = await db.$transaction(async tx => {
      await fileService.deleteFile({
        file: d.document.file,
        client: tx
      });

      return await this.getDocumentRecord(tx, {
        tenant: {
          oid: d.document.tenantOid,
          id: d.document.id
        },
        environment: {
          oid: d.document.environmentOid,
          id: d.document.id
        },
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
