import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import { storeVersionService } from '@metorial/module-store';
import { db, withTransaction } from '@metorial/db';
import { enqueueDocumentLifecycle } from '../queues/lifecycle';
import { documentInclude } from '../services/document';
import { internalDocumentDraftService } from './documentDraft';
import { internalDocumentVersioningService } from './documentVersioning';

let getTextByteSize = (content: string) => new TextEncoder().encode(content).length;

class InternalDocumentSyncServiceImpl {
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
        id: d.cursor
          ? {
              gt: d.cursor
            }
          : undefined
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
        draft: await internalDocumentDraftService.getDraftByDocumentId(child.id)
      }))
    );

    return {
      childDocumentIds: childDrafts
        .filter(child => child.draft === null)
        .map(child => child.childId),
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
        draft: await internalDocumentDraftService.getDraftByDocumentId(child.id)
      }))
    );

    return childDrafts.filter(child => child.draft === null).map(child => child.child);
  }

  async syncChildDocumentVersionFromParentVersion(d: {
    parentDocumentVersionId: string;
    childDocumentId: string;
  }) {
    let result = await internalDocumentDraftService.withDocumentLock(
      d.childDocumentId,
      async () => {
        let draft = await internalDocumentDraftService.getDraftByDocumentId(d.childDocumentId);
        if (draft) return null;

        return await withTransaction(async db => {
          let parentVersion = await db.documentVersion.findFirst({
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

          let { projectOid, instanceOid } = parentVersion;
          if (projectOid == null || instanceOid == null) return null;

          let childDocument = await db.document.findFirst({
            where: {
              id: d.childDocumentId,
              projectOid,
              instanceOid,
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

          let nextVersion = await internalDocumentVersioningService.createVersion({
            project: { oid: projectOid },
            instance: { oid: instanceOid },
            document: childDocument,
            contentOid: parentVersion.contentOid,
            previousVersion: currentVersion,
            listEditedAt: parentVersion.listEditedAt ?? new Date()
          });

          await db.file.update({
            where: {
              id: childDocument.file.id
            },
            data: {
              fileSize: getTextByteSize(parentVersion.content.content)
            }
          });

          let syncedDocument = await db.document.update({
            where: {
              id: childDocument.id
            },
            data: {
              contentOid: parentVersion.contentOid,
              currentVersionOid: nextVersion.oid,
              isContentOwner: false
            },
            include: documentInclude
          });

          return {
            document: syncedDocument,
            createdVersionId: nextVersion.id
          };
        });
      }
    );

    if (result?.createdVersionId) {
      await storeVersionService.touchStoresLastEditedAtForDocument({
        documentOid: result.document.oid
      });

      await storeVersionService.markStoresDirtyForDocument({
        documentOid: result.document.oid
      });
    }

    if (result) {
      await enqueueDocumentLifecycle({
        documentId: result.document.id,
        event: 'contents-changed'
      });
    }

    return result;
  }
}

export let internalDocumentSyncService = Service.create(
  'cargoInternalDocumentSyncService',
  () => new InternalDocumentSyncServiceImpl()
).build();
