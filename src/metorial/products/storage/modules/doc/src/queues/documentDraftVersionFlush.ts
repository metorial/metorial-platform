import { getId } from '@metorial/cargo-config/id';
import { storeVersionService } from '@metorial/cargo-module-store';
import { createCron } from '@metorial/cron';
import { db, withTransaction } from '@metorial/db';
import { combineQueueProcessors, createQueue } from '@metorial/queue';
import { internalDocumentDraftService, internalDocumentVersioningService } from '../internal';
import { documentInclude } from '../services/document';
import { documentVersionSyncManyQueue } from './documentVersionSync';
import { enqueueDocumentLifecycle } from './lifecycle';
let batchSize = 100;

export let documentDraftVersionFlushManyQueue = createQueue<{
  cursor?: string;
}>({
  name: 'cargo/doc/draft-version-flush/many',
  workerOpts: {
    concurrency: 1
  }
});

export let documentDraftVersionFlushSingleQueue = createQueue<{
  documentId: string;
  expectedDraftVersionExpiresAt: Date;
}>({
  name: 'cargo/doc/draft-version-flush/single',
  workerOpts: {
    concurrency: 5
  }
});

export let documentDraftVersionFlushManyProcessor = documentDraftVersionFlushManyQueue.process(
  async data => {
    let documents = await db.document.findMany({
      where: {
        draftVersionExpiresAt: {
          lte: new Date()
        },
        file: {
          status: 'active'
        },
        id: data.cursor
          ? {
              gt: data.cursor
            }
          : undefined
      },
      orderBy: {
        id: 'asc'
      },
      take: batchSize,
      select: {
        oid: true,
        id: true,
        draftVersionExpiresAt: true
      }
    });

    if (documents.length > 0) {
      await documentDraftVersionFlushSingleQueue.addMany(
        documents
          .filter(document => document.draftVersionExpiresAt !== null)
          .map(document => ({
            documentId: document.id,
            expectedDraftVersionExpiresAt: document.draftVersionExpiresAt!
          }))
      );
    }

    if (documents.length === batchSize) {
      await documentDraftVersionFlushManyQueue.add({
        cursor: documents[documents.length - 1]!.id
      });
    }
  }
);

export let flushExpiredDraftVersion = async (d: {
  documentId: string;
  expectedDraftVersionExpiresAt: Date;
}) => {
  let result = await internalDocumentDraftService.withDocumentLock(d.documentId, async () => {
    let draft = await internalDocumentDraftService.getDraftByDocumentId(d.documentId);
    if (draft) return null;

    return await withTransaction(async db => {
      let now = new Date();
      let document = await db.document.findFirst({
        where: {
          id: d.documentId,
          file: {
            status: 'active'
          }
        },
        include: {
          ...documentInclude,
          project: true,
          instance: true
        }
      });
      if (!document || document.isReadOnly || !document.currentVersion) return null;

      let draftVersionExpiresAt = document.draftVersionExpiresAt;
      if (!draftVersionExpiresAt) return null;
      if (!d.expectedDraftVersionExpiresAt) return null;
      if (draftVersionExpiresAt.getTime() !== d.expectedDraftVersionExpiresAt.getTime()) {
        return null;
      }
      if (draftVersionExpiresAt.getTime() > now.getTime()) return null;

      let retiredContentIds = getId('documentContent');
      await db.documentContent.create({
        data: {
          oid: retiredContentIds.oid,
          content: document.content.content
        }
      });

      await db.documentVersion.update({
        where: {
          id: document.currentVersion.id
        },
        data: {
          contentOid: retiredContentIds.oid
        }
      });

      let nextVersion = await internalDocumentVersioningService.createVersion({
        project: document.project,
        instance: document.instance,
        document,
        contentOid: document.contentOid,
        previousVersionOid: document.currentVersion.oid,
        listEditedAt: now
      });

      let updatedDocument = await db.document.update({
        where: {
          id: document.id
        },
        data: {
          currentVersionOid: nextVersion.oid,
          draftVersionExpiresAt: null
        },
        include: documentInclude
      });

      return {
        document: updatedDocument,
        createdVersionId: nextVersion.id
      };
    });
  });

  if (result?.createdVersionId) {
    await storeVersionService.markStoresDirtyForDocument({
      documentOid: result.document.oid
    });
    await documentVersionSyncManyQueue.add(
      { parentDocumentVersionId: result.createdVersionId },
      { id: result.createdVersionId }
    );
  }

  if (result) {
    await enqueueDocumentLifecycle({
      documentId: result.document.id,
      event: 'contents-changed'
    });
  }

  return result;
};

export let documentDraftVersionFlushSingleProcessor =
  documentDraftVersionFlushSingleQueue.process(async data => {
    await flushExpiredDraftVersion({
      documentId: data.documentId,
      expectedDraftVersionExpiresAt: data.expectedDraftVersionExpiresAt
    });
  });

export let documentDraftVersionFlushCron = createCron(
  {
    name: 'cargo/doc/draft-version-flush/cron',
    cron: '*/15 * * * *'
  },
  async () => {
    await documentDraftVersionFlushManyQueue.add({});
  }
);

export let documentDraftVersionFlushProcessors = combineQueueProcessors([
  documentDraftVersionFlushManyProcessor,
  documentDraftVersionFlushSingleProcessor,
  documentDraftVersionFlushCron
]);
