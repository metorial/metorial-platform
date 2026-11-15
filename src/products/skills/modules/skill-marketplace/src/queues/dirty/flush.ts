import { createCron } from '@metorial/cron';
import { db, ID, withTransaction } from '@metorial/db';
import { createQueue } from '@metorial/queue';
import { skillDestinationSyncEligibleWhere } from '../sync/_lib/eligibility';
import { syncStartQueue } from '../sync/start';

let pageSize = 500;

export let flushDirtySkillDestinationsCron = createCron(
  {
    name: 'cargo/skill/dirty/flush/cron',
    cron: '*/1 * * * *'
  },
  async () => {
    await flushDirtySkillDestinationsManyQueue.add({});
  }
);

export let flushDirtySkillDestinationsManyQueue = createQueue<{
  cursor?: string;
}>({
  name: 'cargo/skill/dirty/flush/many',
  workerOpts: {
    concurrency: 1
  }
});

export let flushDirtySkillDestinationsManyQueueProcessor =
  flushDirtySkillDestinationsManyQueue.process(async data => {
    let destinations = await db.skillDestination.findMany({
      where: {
        id: data.cursor ? { gt: data.cursor } : undefined,
        AND: skillDestinationSyncEligibleWhere,
        OR: [{ shouldFlushAt: { lte: new Date() } }, { mustFlushAt: { lte: new Date() } }]
      },
      orderBy: { id: 'asc' },
      select: { id: true },
      take: pageSize
    });

    if (!destinations.length) return;

    await flushDirtySkillDestinationsSingleQueue.addManyWithOps(
      destinations.map(d => ({
        data: { destinationId: d.id },
        opts: { id: d.id }
      }))
    );

    if (destinations.length === pageSize) {
      await flushDirtySkillDestinationsManyQueue.add(
        { cursor: destinations[destinations.length - 1]!.id },
        { delay: 1000 }
      );
    }
  });

let flushDirtySkillDestinationsSingleQueue = createQueue<{
  destinationId: string;
}>({
  name: 'cargo/skill/dirty/flush/single',
  jobOpts: { removeOnFail: true },
  workerOpts: {
    concurrency: 5,
    limiter: { max: 10, duration: 1000 }
  }
});

export let flushDirtySkillDestinationsSingleQueueProcessor =
  flushDirtySkillDestinationsSingleQueue.process(async data => {
    let sync = await withTransaction(async db => {
      let now = new Date();
      let [destination] = await db.skillDestination.updateManyAndReturn({
        where: {
          id: data.destinationId,
          AND: skillDestinationSyncEligibleWhere,
          OR: [
            {
              isDirty: false,
              shouldFlushAt: { lte: now }
            },
            {
              mustFlushAt: { lte: now }
            }
          ]
        },
        data: {
          syncRecoveryVersion: 1,
          isDirty: false,
          lastTransientChangeAt: null,
          firstTransientChangeAt: null,
          shouldFlushAt: null,
          mustFlushAt: null
        }
      });
      if (!destination) return;

      return await db.skillDestinationSync.create({
        data: {
          id: await ID.generateId('skillDestinationSync'),
          destinationOid: destination.oid,
          status: 'pending'
        }
      });
    });
    if (!sync) return;

    await syncStartQueue.add(
      {
        skillDestinationSyncId: sync.id
      },
      { id: sync.id }
    );
  });
