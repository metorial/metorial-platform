import { createCron } from '@metorial/cron';
import { db } from '@metorial/db';
import { combineQueueProcessors, createQueue, hourlyPacedDelay } from '@metorial/queue';
import { internalDocumentParticipantService } from '../internal/documentParticipant';

export let DOCUMENT_PARTICIPANT_BACKFILL_BATCH_SIZE = 500;

export let documentParticipantBackfillCron = createCron(
  {
    name: 'cargo/document/participant/backfill/cron',
    cron: '0 * * * *'
  },
  async () => {
    await documentParticipantBackfillManyQueue.add({});
  }
);

export let documentParticipantBackfillManyQueue = createQueue<{ cursor?: string }>({
  name: 'cargo/document/participant/backfill/many',
  workerOpts: { concurrency: 1 }
});

export let documentParticipantBackfillManyQueueProcessor =
  documentParticipantBackfillManyQueue.process(async data => {
    let participants = await db.documentParticipant.findMany({
      where: {
        storeParticipantOid: null,
        resourceActor: {
          type: { not: 'system' },
          NOT: { organizationActor: { is: { type: 'system' } } }
        },
        document: {
          OR: [{ storeItems: { some: {} } }, { file: { storeItems: { some: {} } } }]
        },
        id: data.cursor ? { gt: data.cursor } : undefined
      },
      orderBy: { id: 'asc' },
      take: DOCUMENT_PARTICIPANT_BACKFILL_BATCH_SIZE,
      select: { id: true }
    });
    if (participants.length === 0) return;

    await documentParticipantBackfillSingleQueue.addManyWithOps(
      participants.map(participant => ({
        data: { documentParticipantId: participant.id },
        opts: { id: participant.id }
      }))
    );

    if (participants.length === DOCUMENT_PARTICIPANT_BACKFILL_BATCH_SIZE) {
      await documentParticipantBackfillManyQueue.add(
        { cursor: participants[participants.length - 1]!.id },
        hourlyPacedDelay()
      );
    }
  });

export let documentParticipantBackfillSingleQueue = createQueue<{
  documentParticipantId: string;
}>({
  name: 'cargo/document/participant/backfill/single',
  workerOpts: { concurrency: 5, limiter: { max: 10, duration: 1000 } }
});

export let documentParticipantBackfillSingleQueueProcessor =
  documentParticipantBackfillSingleQueue.process(async data => {
    await internalDocumentParticipantService.syncStoreParticipant({
      documentParticipantId: data.documentParticipantId
    });
  });

export let documentParticipantBackfillProcessors = combineQueueProcessors([
  documentParticipantBackfillCron,
  documentParticipantBackfillManyQueueProcessor,
  documentParticipantBackfillSingleQueueProcessor
]);
