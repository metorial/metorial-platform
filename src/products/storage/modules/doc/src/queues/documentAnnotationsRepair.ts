import { getSentry } from '@lowerdeck/sentry';
import { db } from '@metorial/db';
import { readStoredAnnotations } from '@metorial/docs-editor-schema';
import { combineQueueProcessors, createQueue } from '@metorial/queue';
import { internalDocumentContentStoreService } from '../internal/documentContentStore';
import { repairStoredDocumentBody } from '../lib/documentBody';

let Sentry = getSentry();

export let documentAnnotationsRepairQueue = createQueue<{ contentOid: string }>({
  name: 'cargo/doc/annotationsRepair',
  workerOpts: {
    concurrency: 5
  }
});

export let verifyDocumentContentAnnotations = async (content: {
  oid: bigint;
  content: string;
  annotations: unknown;
}) => {
  let stored = readStoredAnnotations(content);
  if (stored.status === 'verified') return stored;

  if (stored.status !== 'missing') {
    Sentry.captureMessage('Document annotations do not match their content', {
      level: 'warning',
      extra: {
        contentOid: content.oid.toString(),
        status: stored.status
      }
    });
  }

  await documentAnnotationsRepairQueue.add(
    { contentOid: content.oid.toString() },
    { id: content.oid.toString() }
  );

  return stored;
};

export let documentAnnotationsRepairProcessor = documentAnnotationsRepairQueue.process(
  async data => {
    let content = await db.documentContent.findFirst({
      where: {
        oid: BigInt(data.contentOid)
      },
      include: {
        documents: {
          take: 1,
          orderBy: { oid: 'asc' },
          include: { createdByResourceActor: true }
        },
        documentVersions: {
          take: 1,
          orderBy: { oid: 'asc' },
          include: { document: { include: { createdByResourceActor: true } } }
        }
      }
    });
    if (!content) return;

    let stored = readStoredAnnotations(content);
    if (stored.status === 'verified') return;

    let document = content.documents[0] ?? content.documentVersions[0]?.document;
    if (!document) return;

    await internalDocumentContentStoreService.replaceAnnotationsIfContentUnchanged({
      oid: content.oid,
      body: repairStoredDocumentBody({
        title: document.title,
        content: content.content,
        annotations: content.annotations,
        creatorId: document.createdByResourceActor?.id
      })
    });
  }
);

export let documentAnnotationsRepairProcessors = combineQueueProcessors([
  documentAnnotationsRepairProcessor
]);
