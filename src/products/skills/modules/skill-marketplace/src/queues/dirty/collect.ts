import { createCron } from '@metorial/cron';
import { db, withTransaction, type Prisma } from '@metorial/db';
import { createQueue } from '@metorial/queue';
import { addMinutes } from 'date-fns';
import { skillDestinationSyncEligibleWhere } from '../sync/_lib/eligibility';

let pageSize = 500;

let unreconciledDestinationWhere = {
  syncRecoveryVersion: { lt: 1 },
  syncs: { none: { status: { in: ['pending', 'processing'] } } },
  OR: [
    { skillMarketplace: { status: 'active', repositories: { some: {} } } },
    { skillPlugin: { status: 'active', repositories: { some: {} } } }
  ]
} satisfies Prisma.SkillDestinationWhereInput;

export let collectDirtySkillDestinationsCron = createCron(
  {
    name: 'cargo/skill/dirty/col/cron',
    cron: '*/1 * * * *'
  },
  async () => {
    await collectDirtySkillDestinationsManyQueue.add({});
  }
);

export let collectDirtySkillDestinationsManyQueue = createQueue<{
  cursor?: string;
}>({
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
        AND: skillDestinationSyncEligibleWhere,
        OR: [{ isDirty: true }, unreconciledDestinationWhere]
      },
      orderBy: { id: 'asc' },
      select: { id: true },
      take: pageSize
    });

    if (!destinations.length) return;

    await collectDirtySkillDestinationsSingleQueue.addManyWithOps(
      destinations.map(d => ({
        data: { destinationId: d.id },
        opts: { id: d.id }
      }))
    );

    if (destinations.length === pageSize) {
      await collectDirtySkillDestinationsManyQueue.add(
        { cursor: destinations[destinations.length - 1]!.id },
        { delay: 1000 }
      );
    }
  });

let collectDirtySkillDestinationsSingleQueue = createQueue<{
  destinationId: string;
}>({
  name: 'cargo/skill/dirty/col/single',
  jobOpts: { removeOnFail: true },
  workerOpts: {
    concurrency: 5,
    limiter: { max: 10, duration: 1000 }
  }
});

export let collectDirtySkillDestinationsSingleQueueProcessor =
  collectDirtySkillDestinationsSingleQueue.process(async data => {
    await withTransaction(async db => {
      let now = new Date();
      let [destination] = await db.skillDestination.updateManyAndReturn({
        where: {
          id: data.destinationId,
          AND: skillDestinationSyncEligibleWhere,
          OR: [{ isDirty: true }, unreconciledDestinationWhere]
        },
        data: {
          isDirty: false
        }
      });
      if (!destination) return;

      let firstTransientChangeAt =
        destination.firstTransientChangeAt ?? destination.lastTransientChangeAt ?? now;
      let shouldFlushAt = destination.lastTransientChangeAt
        ? addMinutes(destination.lastTransientChangeAt, 5)
        : (destination.shouldFlushAt ?? addMinutes(now, 5));

      await db.skillDestination.updateMany({
        where: {
          id: destination.id,
          isDirty: false,
          lastTransientChangeAt: destination.lastTransientChangeAt
        },
        data: {
          firstTransientChangeAt,
          shouldFlushAt,
          mustFlushAt: destination.mustFlushAt ?? addMinutes(firstTransientChangeAt, 60)
        }
      });
    });
  });
