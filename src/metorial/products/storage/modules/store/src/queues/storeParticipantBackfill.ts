import { createCron } from '@metorial/cron';
import { db } from '@metorial/db';
import { combineQueueProcessors, createQueue, hourlyPacedDelay } from '@metorial/queue';
import { legacyStoreParticipantActorWhere } from '../lib/participantActorRows';
import { storeAccessService } from '../services/storeAccess';
import { storeParticipantService } from '../services/storeParticipant';

export let STORE_PARTICIPANT_BACKFILL_BATCH_SIZE = 500;

export let storeParticipantBackfillCron = createCron(
  {
    name: 'cargo/store/participant/backfill/cron',
    cron: '0,30 * * * *'
  },
  async () => {
    await storeParticipantBackfillManyQueue.add({});
  }
);

let repairParticipantRoles = async () => {
  let oids = await storeParticipantService.findParticipantsMissingActorRoles({
    limit: STORE_PARTICIPANT_BACKFILL_BATCH_SIZE
  });

  for (let oid of oids) {
    await storeParticipantService.syncParticipantRoles({ storeParticipantOid: oid });
  }
};

export let storeParticipantBackfillManyQueue = createQueue<{ cursor?: string }>({
  name: 'cargo/store/participant/backfill/many',
  workerOpts: { concurrency: 1 }
});

export let storeParticipantBackfillManyQueueProcessor =
  storeParticipantBackfillManyQueue.process(async data => {
    if (!data.cursor) await repairParticipantRoles();

    let rows = await db.storeParticipantActor.findMany({
      where: {
        AND: [legacyStoreParticipantActorWhere],
        storeParticipantOid: null,
        resourceActor: {
          type: { not: 'system' },
          NOT: { organizationActor: { is: { type: 'system' } } }
        },
        id: data.cursor ? { gt: data.cursor } : undefined
      },
      orderBy: { id: 'asc' },
      take: STORE_PARTICIPANT_BACKFILL_BATCH_SIZE,
      select: { id: true }
    });
    if (rows.length === 0) return;

    await storeParticipantBackfillSingleQueue.addManyWithOps(
      rows.map(row => ({ data: { storeParticipantActorId: row.id }, opts: { id: row.id } }))
    );

    if (rows.length === STORE_PARTICIPANT_BACKFILL_BATCH_SIZE) {
      await storeParticipantBackfillManyQueue.add(
        { cursor: rows[rows.length - 1]!.id },
        hourlyPacedDelay()
      );
    }
  });

export let storeParticipantBackfillSingleQueue = createQueue<{
  storeParticipantActorId: string;
}>({
  name: 'cargo/store/participant/backfill/single',
  workerOpts: { concurrency: 5, limiter: { max: 10, duration: 1000 } }
});

export let storeParticipantBackfillSingleQueueProcessor =
  storeParticipantBackfillSingleQueue.process(async data => {
    let row = await db.storeParticipantActor.findUnique({
      where: { id: data.storeParticipantActorId }
    });
    if (!row) return;

    if (!row.storeParticipantOid) {
      await storeParticipantService.recordParticipation({
        store: { oid: row.storeOid },
        actor: { oid: row.resourceActorOid },
        roles: row.roles,
        activeAt: row.lastActiveAt ?? row.updatedAt,
        createdAt: row.createdAt
      });
    }

    await storeAccessService.syncStandaloneStoreGrantsForActorRow({
      storeParticipantActorId: row.id
    });
  });

export let storeParticipantBackfillProcessors = combineQueueProcessors([
  storeParticipantBackfillCron,
  storeParticipantBackfillManyQueueProcessor,
  storeParticipantBackfillSingleQueueProcessor
]);
