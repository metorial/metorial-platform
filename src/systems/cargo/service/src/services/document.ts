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
  StoreCloneType,
  StoreParticipantPermissions,
  TenantActor
} from '../../prisma/generated/client';
import { db, withTransaction } from '../db';
import { getId } from '../id';
import { documentFlushQueue } from '../queues/documentFlush';
import { documentVersionSyncManyQueue } from '../queues/documentVersionSync';
import { actorService } from './actor';
import { getEffectiveDocumentStoreSource } from './documentContentStore';
import { documentDraftService, type DocumentDraft } from './documentDraft';
import { fileService } from './file';
import { filePurposeService, type CargoTenantEnvironment } from './filePurpose';
import { storeAccessService, storeReadPermission, storeWritePermission } from './storeAccess';
import { storeItemMutationService } from './storeItemMutation';
import { storeVersionService } from './storeVersion';

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

export type ScopedResolvedDocumentRecord = {
  tenant: {
    id: string;
    oid: bigint;
  };
  environment: {
    id: string;
    oid: bigint;
  };
  document: ResolvedDocumentRecord;
};

type DocumentRecord = Prisma.DocumentGetPayload<{
  include: typeof documentInclude;
}>;
type VersionContext = {
  tenant: { oid: bigint };
  environment: { oid: bigint };
};
type DocumentWithEffectiveStoreId<T extends { file: { storeId: string } }> = T & {
  file: T['file'] & {
    effectiveStoreId?: string;
  };
};
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

  private async queueDocumentVersionSync(parentDocumentVersionId: string) {
    await documentVersionSyncManyQueue.add(
      { parentDocumentVersionId },
      {
        id: parentDocumentVersionId
      }
    );
  }

  private async getDocumentRecord(
    d: CargoTenantEnvironment & {
      documentId: string;
      includeDeleted?: boolean;
    }
  ) {
    return await withTransaction(
      async db => {
        let document = await db.document.findFirst({
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
      },
      { ifExists: true }
    );
  }

  private async resolveDocument(document: DocumentRecord): Promise<ResolvedDocumentRecord> {
    let draft = await documentDraftService.getDraftByDocumentId(document.id);
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

  private async withEffectiveFileStore<T extends DocumentRecord | ResolvedDocumentRecord>(document: T) {
    let effectiveStoreSource = await getEffectiveDocumentStoreSource(document);
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

  private async getParentLiveContent(document: Pick<DocumentRecord, 'isContentOwner' | 'parentDocumentOid'>) {
    return await withTransaction(
      async db => {
        if (!document.parentDocumentOid) {
          return null;
        }

        return await db.document.findFirst({
          where: {
            oid: document.parentDocumentOid,
            file: {
              status: 'active'
            }
          },
          select: {
            contentOid: true,
            content: {
              select: {
                content: true
              }
            }
          }
        });
      },
      { ifExists: true }
    );
  }

  private async getParentSyncState(d: {
    document: Pick<DocumentRecord, 'isContentOwner' | 'parentDocumentOid'>;
    nextContent: string;
  }) {
    let parentLiveContent = await this.getParentLiveContent(d.document);
    let shouldKeepParentSync =
      !d.document.isContentOwner &&
      !!parentLiveContent &&
      parentLiveContent.content.content === d.nextContent;

    return {
      parentLiveContent,
      shouldKeepParentSync
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

  private assertDocumentWritable(document: Pick<DocumentRecord, 'id' | 'isReadOnly'>) {
    if (document.isReadOnly) {
      throw new ServiceError(
        forbiddenError({
          message: `Document ${document.id} is read-only`
        })
      );
    }
  }

  private async upsertParticipant(
    d: {
      document: { oid: bigint };
      actor: { oid: bigint };
      mode: 'view' | 'edit';
    }
  ) {
    return await withTransaction(async tx => {
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
    });
  }

  async ensureDocumentParticipant(d: {
    document: { oid: bigint };
    actor: { oid: bigint };
    mode: 'view' | 'edit';
  }) {
    return await this.upsertParticipant(d);
  }

  async materializeDocumentParticipantsFromStores(d: {
    document: Document;
  }) {
    return await withTransaction(async client => {
      let storeActors = await storeAccessService.listStoreParticipantActorsForDocument({
        document: d.document
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

      for (let item of actorsById.values()) {
        await this.upsertParticipant({
          document: d.document,
          actor: item.actor,
          mode: item.mode
        });
      }
    });
  }

  private async ensureVersionEditor(
    d: {
      version: { oid: bigint };
      document: { oid: bigint };
      actor: { oid: bigint };
    }
  ) {
    return await withTransaction(async tx => {
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
    });
  }

  private async createVersion(
    d: VersionContext & {
      document: { oid: bigint };
      versionNumber: number;
      contentOid: bigint;
      previousVersionOid?: bigint | null;
      listEditedAt?: Date;
    }
  ) {
    return await withTransaction(async tx => {
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
    });
  }

  private async writeDocumentContent(
    d: CargoTenantEnvironment & {
      document: DocumentRecord;
      nextContent: string;
      listEditedAt?: Date;
    }
  ) {
    return await withTransaction(async tx => {
      let now = new Date();
      let shouldCreateNewVersion =
        !d.document.currentVersion ||
        now.getTime() - d.document.currentVersion.createdAt.getTime() >= activeVersionWindowMs;

      let liveContentOid = d.document.contentOid;
      let activeVersion = d.document.currentVersion;
      let nextVersionNumber = d.document.maxVersionNumber;
      let didCreateVersion = false;
      let { parentLiveContent, shouldKeepParentSync } = await this.getParentSyncState({
        document: d.document,
        nextContent: d.nextContent
      });
      let shouldDetachOwnedContent =
        d.document.isContentOwner &&
        !!parentLiveContent &&
        parentLiveContent.contentOid === d.document.contentOid;

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
          if (shouldDetachOwnedContent) {
            let liveContentIds = getId('documentContent');

            await tx.documentContent.create({
              data: {
                oid: liveContentIds.oid,
                content: d.nextContent
              }
            });

            liveContentOid = liveContentIds.oid;
          } else {
            await tx.documentContent.update({
              where: {
                oid: d.document.contentOid
              },
              data: {
                content: d.nextContent
              }
            });
          }
        } else if (shouldKeepParentSync) {
          liveContentOid = parentLiveContent!.contentOid;
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

        activeVersion = await this.createVersion({
          tenant: d.tenant,
          environment: d.environment,
          document: d.document,
          versionNumber: nextVersionNumber,
          contentOid: liveContentOid,
          previousVersionOid: d.document.currentVersion?.oid,
          listEditedAt: d.listEditedAt
        });
        didCreateVersion = true;
      } else if (d.document.isContentOwner) {
        if (shouldDetachOwnedContent) {
          let liveContentIds = getId('documentContent');

          await tx.documentContent.create({
            data: {
              oid: liveContentIds.oid,
              content: d.nextContent
            }
          });

          liveContentOid = liveContentIds.oid;

          if (!d.document.currentVersion) {
            activeVersion = await this.createVersion({
              tenant: d.tenant,
              environment: d.environment,
              document: d.document,
              versionNumber: d.document.maxVersionNumber + 1,
              contentOid: liveContentOid,
              listEditedAt: d.listEditedAt
            });

            nextVersionNumber += 1;
            didCreateVersion = true;
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
        } else {
          await tx.documentContent.update({
            where: {
              oid: d.document.contentOid
            },
            data: {
              content: d.nextContent
            }
          });
        }
      } else if (shouldKeepParentSync) {
        liveContentOid = parentLiveContent!.contentOid;

        if (!d.document.currentVersion) {
          activeVersion = await this.createVersion({
            tenant: d.tenant,
            environment: d.environment,
            document: d.document,
            versionNumber: d.document.maxVersionNumber + 1,
            contentOid: liveContentOid,
            listEditedAt: d.listEditedAt
          });

          nextVersionNumber += 1;
          didCreateVersion = true;
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
          activeVersion = await this.createVersion({
            tenant: d.tenant,
            environment: d.environment,
            document: d.document,
            versionNumber: d.document.maxVersionNumber + 1,
            contentOid: liveContentOid,
            listEditedAt: d.listEditedAt
          });

          nextVersionNumber += 1;
          didCreateVersion = true;
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
        isContentOwner: d.document.isContentOwner || !shouldKeepParentSync,
        didCreateVersion
      };
    });
  }

  private async persistDraftToDocument(
    d: CargoTenantEnvironment & {
      document: DocumentRecord;
      draft: DocumentDraft;
      actors: TenantActor[];
    }
  ) {
    return await withTransaction(async tx => {
      let nextTitle = d.draft.title;
      let nextContent = d.draft.content;
      let hasContentChange = nextContent !== d.document.content.content;
      let hasTitleChange = nextTitle !== d.document.title;

      if (!hasContentChange && !hasTitleChange) {
        return {
          document: d.document,
          createdVersionId: null,
          didPersistChange: false
        };
      }

      let activeVersion = d.document.currentVersion;
      let liveContentOid = d.document.contentOid;
      let maxVersionNumber = d.document.maxVersionNumber;
      let isContentOwner = d.document.isContentOwner;
      let createdVersionId: string | null = null;

      if (hasContentChange) {
        let listEditedAt = new Date();

        let writeResult = await this.writeDocumentContent({
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
        createdVersionId = writeResult.didCreateVersion ? (writeResult.activeVersion?.id ?? null) : null;
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
          await this.ensureVersionEditor({
            version: activeVersion,
            document: updatedDocument,
            actor
          });
        }
      }

      return {
        document: updatedDocument,
        createdVersionId,
        didPersistChange: true
      };
    });
  }

  async createDocument(
    d: CargoTenantEnvironment & {
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

    return await withTransaction(async tx => {
      let documentIds = d.input.id
        ? { oid: getId('document').oid, id: d.input.id }
        : getId('document');
      let contentIds = getId('documentContent');

      let file = await fileService.createFile({
        tenant: d.tenant,
        environment: d.environment,
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
          isReadOnly: d.internal?.isReadOnly ?? false,
          isTemplateBacking: d.internal?.isTemplateBacking ?? false,
          isContentOwner: true,
          maxVersionNumber: 1,
          contentOid: contentIds.oid,
          createdByTenantActorOid: actor?.oid
        },
        include: documentInclude
      });

      let version = await this.createVersion({
        tenant: d.tenant,
        environment: d.environment,
        document,
        versionNumber: 1,
        contentOid: contentIds.oid,
        listEditedAt: new Date()
      });

      if (actor) {
        await this.upsertParticipant({
          document,
          actor,
          mode: 'edit'
        });

        await this.ensureVersionEditor({
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
    d: CargoTenantEnvironment & {
      documentId: string;
      includeDeleted?: boolean;
      actorId?: string;
      defaultPermissions?: StoreParticipantPermissions[];
      overridePermissions?: boolean;
    }
  ) {
    let document = await this.getDocumentRecord(d);
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
      await withTransaction(async () => {
        await this.upsertParticipant({
          document,
          actor: access.actor!,
          mode: 'view'
        });
      });
    }

    return await this.resolveDocument(document);
  }

  async getDocumentPermissions(
    d: CargoTenantEnvironment & {
      document: {
        id: string;
        oid: bigint;
        fileOid: bigint;
        isReadOnly?: boolean;
        createdByTenantActorOid?: bigint | null;
      };
      actorId?: string;
      defaultPermissions?: StoreParticipantPermissions[];
      overridePermissions?: boolean;
    }
  ) {
    return await storeAccessService.getDocumentPermissions({
      tenant: d.tenant,
      environment: d.environment,
      document: d.document,
      actorId: d.actorId,
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
        ...(d.includeDeleted ? {} : { file: { status: 'active' } })
      },
      include: {
        ...documentInclude,
        tenant: {
          select: {
            id: true,
            oid: true
          }
        },
        environment: {
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

    let { tenant, environment, ...document } = scopedDocument;

    return {
      tenant,
      environment,
      document: await this.resolveDocument(document)
    } satisfies ScopedResolvedDocumentRecord;
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
                isTemplateBacking: false,
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
              isTemplateBacking: false,
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
    this.assertDocumentWritable(d.document);

    let resolved = await documentDraftService.withDocumentLock(d.document.id, async () => {
      let currentDraft = await documentDraftService.getDraftByDocumentId(d.document.id);
      let currentContent = currentDraft?.content ?? d.document.resolvedContent ?? d.document.content.content;
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
      let nextIsContentOwner = d.document.isContentOwner;

      if (
        d.input.content !== undefined &&
        currentContent !== nextDraft.content &&
        !d.document.isContentOwner
      ) {
        let { shouldKeepParentSync } = await this.getParentSyncState({
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

      await documentDraftService.setDraft(nextDraft);
      await documentDraftService.markDocumentDirty(d.document.id, nextDraft.revision);

      return {
        ...d.document,
        isContentOwner: nextIsContentOwner,
        resolvedTitle: nextDraft.title,
        resolvedContent: nextDraft.content,
        hasDraft: true,
        draftRevision: nextDraft.revision,
        draftUpdatedAt: new Date(nextDraft.updatedAt)
      } satisfies ResolvedDocumentRecord;
    });

    if (actor) {
      await withTransaction(async () => {
        await this.upsertParticipant({
          document: d.document,
          actor,
          mode: 'edit'
        });
      });
    }

    await this.queueDocumentFlush(d.document.id, draftFlushDelayMs);

    return await this.withEffectiveFileStore(resolved);
  }

  async flushDocumentDraft(d: { documentId: string; force?: boolean; queuedRevision?: number }) {
    return await documentDraftService.withDocumentLock(d.documentId, async () => {
      let draft = await documentDraftService.getDraftByDocumentId(d.documentId);
      if (!draft) {
        if (d.queuedRevision !== undefined) {
          await documentDraftService.clearDocumentMarkersUpToRevision(
            d.documentId,
            d.queuedRevision
          );
        }

        return null;
      }

      let flushAfterMs = new Date(draft.flushAfter).getTime();
      if (!d.force && flushAfterMs > Date.now()) {
        await this.queueDocumentFlush(d.documentId, flushAfterMs - Date.now());
        return null;
      }

      let result = await withTransaction(async tx => {
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
        this.assertDocumentWritable(currentDocument);

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

        return await this.persistDraftToDocument({
          tenant: currentDocument.tenant,
          environment: currentDocument.environment,
          document: currentDocument,
          draft,
          actors
        });
      });

      await documentDraftService.deleteDraft(d.documentId);
      await documentDraftService.clearDocumentMarkersUpToRevision(d.documentId, draft.revision);
      if (result.didPersistChange) {
        await storeVersionService.touchStoresLastEditedAtForDocument({
          documentOid: result.document.oid
        });
      }

      if (result.createdVersionId) {
        await storeVersionService.markStoresDirtyForDocument({
          documentOid: result.document.oid
        });
        await this.queueDocumentVersionSync(result.createdVersionId);
      }

      return await this.resolveDocument(result.document);
    });
  }

  async listSyncableChildDocumentIdsForVersionSync(d: {
    parentDocumentVersionId: string;
    cursor?: string;
    limit: number;
  }) {
    let parentVersion = await db.documentVersion.findFirst({
      where: {
        id: d.parentDocumentVersionId,
        document: {
          file: {
            status: 'active'
          }
        }
      },
      select: {
        documentOid: true
      }
    });
    if (!parentVersion) {
      return {
        childDocumentIds: [],
        nextCursor: undefined
      };
    }

    let children = await db.document.findMany({
      where: {
        parentDocumentOid: parentVersion.documentOid,
        isContentOwner: false,
        file: {
          status: 'active'
        },
        ...(d.cursor
          ? {
              id: {
                gt: d.cursor
              }
            }
          : {})
      },
      orderBy: {
        id: 'asc'
      },
      take: d.limit,
      select: {
        id: true
      }
    });

    let childDrafts = await Promise.all(
      children.map(async child => ({
        childId: child.id,
        draft: await documentDraftService.getDraftByDocumentId(child.id)
      }))
    );

    return {
      childDocumentIds: childDrafts.filter(child => child.draft === null).map(child => child.childId),
      nextCursor: children.length === d.limit ? children[children.length - 1]!.id : undefined
    };
  }

  async listLinkedChildDocumentsForLiveSync(d: { parentDocumentId: string }) {
    let parentDocument = await db.document.findFirst({
      where: {
        id: d.parentDocumentId,
        file: {
          status: 'active'
        }
      },
      select: {
        oid: true
      }
    });
    if (!parentDocument) {
      throw new ServiceError(notFoundError('document', d.parentDocumentId));
    }

    let children = await db.document.findMany({
      where: {
        parentDocumentOid: parentDocument.oid,
        isContentOwner: false,
        file: {
          status: 'active'
        }
      },
      include: documentInclude
    });

    let childDrafts = await Promise.all(
      children.map(async child => ({
        child,
        draft: await documentDraftService.getDraftByDocumentId(child.id)
      }))
    );

    return childDrafts
      .filter(child => child.draft === null)
      .map(child => child.child);
  }

  async syncChildDocumentVersionFromParentVersion(d: {
    parentDocumentVersionId: string;
    childDocumentId: string;
  }) {
    let result = await documentDraftService.withDocumentLock(d.childDocumentId, async () => {
      let draft = await documentDraftService.getDraftByDocumentId(d.childDocumentId);
      if (draft) return null;

      return await withTransaction(async tx => {
        let parentVersion = await tx.documentVersion.findFirst({
          where: {
            id: d.parentDocumentVersionId,
            document: {
              file: {
                status: 'active'
              }
            }
          },
          include: {
            content: true
          }
        });
        if (!parentVersion) return null;

        let childDocument = await tx.document.findFirst({
          where: {
            id: d.childDocumentId,
            tenantOid: parentVersion.tenantOid,
            environmentOid: parentVersion.environmentOid,
            parentDocumentOid: parentVersion.documentOid,
            isContentOwner: false,
            file: {
              status: 'active'
            }
          },
          include: documentInclude
        });
        if (!childDocument) return null;

        let currentVersion = childDocument.currentVersion;
        let currentListEditedAt = currentVersion?.listEditedAt?.getTime() ?? null;
        let parentListEditedAt = parentVersion.listEditedAt?.getTime() ?? null;
        if (
          currentVersion &&
          currentVersion.contentOid === parentVersion.contentOid &&
          currentListEditedAt === parentListEditedAt
        ) {
          return {
            document: childDocument,
            createdVersionId: null
          };
        }

        let nextVersionNumber = childDocument.maxVersionNumber + 1;
        let nextVersion = await this.createVersion({
          tenant: {
            oid: parentVersion.tenantOid
          },
          environment: {
            oid: parentVersion.environmentOid
          },
          document: childDocument,
          versionNumber: nextVersionNumber,
          contentOid: parentVersion.contentOid,
          previousVersionOid: currentVersion?.oid,
          listEditedAt: parentVersion.listEditedAt ?? new Date()
        });

        await tx.file.update({
          where: {
            id: childDocument.file.id
          },
          data: {
            fileSize: getTextByteSize(parentVersion.content.content)
          }
        });

        let syncedDocument = await tx.document.update({
          where: {
            id: childDocument.id
          },
          data: {
            contentOid: parentVersion.contentOid,
            currentVersionOid: nextVersion.oid,
            maxVersionNumber: nextVersionNumber,
            isContentOwner: false
          },
          include: documentInclude
        });

        return {
          document: syncedDocument,
          createdVersionId: nextVersion.id
        };
      });
    });

    if (result?.createdVersionId) {
      await storeVersionService.touchStoresLastEditedAtForDocument({
        documentOid: result.document.oid
      });

      await storeVersionService.markStoresDirtyForDocument({
        documentOid: result.document.oid
      });
    }

    return result;
  }

  async cloneDocument(
    d: CargoTenantEnvironment & {
      document: ResolvedDocumentRecord;
      input: {
        id?: string;
        title?: string;
        cloneType?: StoreCloneType;
        actorId?: string;
        creatorActorId?: string;
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
    let creatorActor = d.input.creatorActorId
      ? await actorService.getActorById({
          tenant: d.tenant,
          actorId: d.input.creatorActorId
        })
      : access.actor;

    this.ensureDocumentActive(d.document);

    let purpose = await filePurposeService.ensureDocumentFilePurpose();
    let cloneType = d.input.cloneType ?? 'sync_until_change';

    let clonedDocument = await withTransaction(async tx => {
      let documentIds = d.input.id
        ? { oid: getId('document').oid, id: d.input.id }
        : getId('document');
      let contentIds = getId('documentContent');
      let sourceTitle = d.document.resolvedTitle ?? d.document.title;
      let sourceContent = d.document.resolvedContent ?? d.document.content.content;
      let nextTitle = d.input.title ?? sourceTitle;

      let file = await fileService.createFile({
        tenant: d.tenant,
        environment: d.environment,
        purpose: purpose.id,
        storeId: getDocumentStoreId(documentIds.id),
        _isDocument: true,
        input: {
          name: nextTitle,
          mimeType: documentMimeType,
          size: getTextByteSize(sourceContent),
          title: nextTitle,
          actorId: creatorActor?.id
        }
      });

      if (cloneType === 'duplicate') {
        await tx.documentContent.create({
          data: {
            oid: contentIds.oid,
            content: sourceContent
          }
        });
      }

      let document = await tx.document.create({
        data: {
          oid: documentIds.oid,
          id: documentIds.id,
          tenantOid: d.tenant.oid,
          environmentOid: d.environment.oid,
          fileOid: file.oid,
          title: nextTitle,
          isContentOwner: cloneType === 'duplicate',
          maxVersionNumber: 1,
          contentOid: cloneType === 'duplicate' ? contentIds.oid : d.document.contentOid,
          parentDocumentOid: cloneType === 'sync_until_change' ? d.document.oid : null,
          createdByTenantActorOid: creatorActor?.oid
        },
        include: documentInclude
      });

      let version = await this.createVersion({
        tenant: d.tenant,
        environment: d.environment,
        document,
        versionNumber: 1,
        contentOid: cloneType === 'duplicate' ? contentIds.oid : d.document.contentOid,
        listEditedAt: new Date()
      });

      let nextDocument = await tx.document.update({
        where: {
          id: document.id
        },
        data: {
          currentVersionOid: version.oid
        },
        include: documentInclude
      });

      if (creatorActor) {
        await this.upsertParticipant({
          document: nextDocument,
          actor: creatorActor,
          mode: 'edit'
        });

        await this.ensureVersionEditor({
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
    this.assertDocumentWritable(d.document);

    let deletedDocument = await withTransaction(async tx => {
      await fileService.deleteFile({
        file: d.document.file
      });

      return await this.getDocumentRecord({
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
