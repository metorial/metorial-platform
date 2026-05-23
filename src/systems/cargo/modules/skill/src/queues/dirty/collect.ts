import { createCron } from '@mtsrc/cron';
import { createQueue } from '@mtsrc/queue';
import { db, env } from '@metorial-cargo/db';
import { addMinutes } from 'date-fns';

export let collectDirtySkillDestinationsCron = createCron(
  {
    redisUrl: env.service.REDIS_URL,
    name: 'cargo/skill/dirty/col/cron',
    cron: '*/1 * * * *'
  },
  async () => {
    await collectDirtySkillDestinationsManyQueue.add({});
  }
);

let collectDirtySkillDestinationsManyQueue = createQueue<{
  cursor?: string;
}>({
  redisUrl: env.service.REDIS_URL,
  name: 'cargo/skill/dirty/col/many',
  workerOpts: {
    concurrency: 1
  }
});

export let collectDirtySkillDestinationsManyQueueProcessor =
  collectDirtySkillDestinationsManyQueue.process(async data => {
    let destinations = await db.skillDestination.findMany({
      where: {
        id: data.cursor ? { gt: data.cursor } : undefined,
        isDirty: true
      },
      orderBy: { id: 'asc' },
      take: 100
    });

    if (!destinations.length) return;

    await collectDirtySkillDestinationsSingleQueue.addManyWithOps(
      destinations.map(d => ({
        data: { destinationId: d.id },
        opts: { id: d.id }
      }))
    );

    await collectDirtySkillDestinationsManyQueue.add({
      cursor: destinations[destinations.length - 1]!.id
    });
  });

let collectDirtySkillDestinationsSingleQueue = createQueue<{
  destinationId: string;
}>({
  redisUrl: env.service.REDIS_URL,
  name: 'cargo/skill/dirty/col/single',
  workerOpts: {
    concurrency: 5
  }
});

export let collectDirtySkillDestinationsSingleQueueProcessor =
  collectDirtySkillDestinationsSingleQueue.process(async data => {
    let now = new Date();
    let [destination] = await db.skillDestination.updateManyAndReturn({
      where: {
        id: data.destinationId,
        isDirty: true
      },
      data: {
        isDirty: false
      }
    });
    if (!destination) return;

    let firstTransientChangeAt =
      destination.firstTransientChangeAt ?? destination.lastTransientChangeAt ?? now;
    let lastTransientChangeAt = destination.lastTransientChangeAt ?? now;

    await db.skillDestination.updateMany({
      where: {
        id: destination.id,
        isDirty: false,
        lastTransientChangeAt: destination.lastTransientChangeAt
      },
      data: {
        firstTransientChangeAt,
        shouldFlushAt: addMinutes(lastTransientChangeAt, 5),
        mustFlushAt: destination.mustFlushAt ?? addMinutes(firstTransientChangeAt, 60)
      }
    });
  });
