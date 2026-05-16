import { createCron } from '@lowerdeck/cron';
import { createQueue } from '@lowerdeck/queue';
import { db, env, getId } from '@metorial-cargo/db';
import { syncStartQueue } from '../sync/start';

export let flushDirtySkillDestinationsCron = createCron(
  {
    redisUrl: env.service.REDIS_URL,
    name: 'cargo/skill/dirty/flush/cron',
    cron: '*/1 * * * *'
  },
  async () => {
    await flushDirtySkillDestinationsManyQueue.add({});
  }
);

let flushDirtySkillDestinationsManyQueue = createQueue<{
  cursor?: string;
}>({
  redisUrl: env.service.REDIS_URL,
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
        OR: [{ shouldFlushAt: { lte: new Date() } }, { mustFlushAt: { lte: new Date() } }]
      },
      orderBy: { id: 'asc' },
      take: 100
    });

    if (!destinations.length) return;

    await flushDirtySkillDestinationsSingleQueue.addManyWithOps(
      destinations.map(d => ({
        data: { destinationId: d.id },
        opts: { id: d.id }
      }))
    );

    await flushDirtySkillDestinationsManyQueue.add({
      cursor: destinations[destinations.length - 1]!.id
    });
  });

let flushDirtySkillDestinationsSingleQueue = createQueue<{
  destinationId: string;
}>({
  redisUrl: env.service.REDIS_URL,
  name: 'cargo/skill/dirty/flush/single',
  workerOpts: {
    concurrency: 5
  }
});

export let flushDirtySkillDestinationsSingleQueueProcessor =
  flushDirtySkillDestinationsSingleQueue.process(async data => {
    let now = new Date();
    let [destination] = await db.skillDestination.updateManyAndReturn({
      where: {
        id: data.destinationId,
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
        isDirty: false,
        lastTransientChangeAt: null,
        firstTransientChangeAt: null,
        shouldFlushAt: null,
        mustFlushAt: null
      }
    });
    if (!destination) return;

    let sync = await db.skillDestinationSync.create({
      data: {
        ...getId('skillDestinationSync'),
        destinationOid: destination.oid,
        status: 'pending'
      }
    });

    await syncStartQueue.add({
      skillDestinationSyncId: sync.id
    });
  });
