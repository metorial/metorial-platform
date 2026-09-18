import { db } from '@metorial/db';
import { createQueue, hourlyPacedDelay } from '@metorial/queue';
import { indexEventDestinationQueue } from './eventDestination';

let batchSize = 500;

export let startFullEventDestinationReindex = async () => {
  await reindexEventDestinationsManyQueue.add({});
};

export let reindexEventDestinationsManyQueue = createQueue<{ cursor?: string }>({
  name: 'audit/eventDestination/search/reindex/many',
  workerOpts: { concurrency: 1 }
});

export let reindexEventDestinationsManyQueueProcessor =
  reindexEventDestinationsManyQueue.process(async data => {
    let eventDestinations = await db.eventDestination.findMany({
      where: { id: data.cursor ? { gt: data.cursor } : undefined },
      orderBy: { id: 'asc' },
      select: { id: true },
      take: batchSize
    });
    if (eventDestinations.length === 0) return;

    await indexEventDestinationQueue.addManyWithOps(
      eventDestinations.map(eventDestination => ({
        data: { eventDestinationId: eventDestination.id },
        opts: { id: eventDestination.id }
      }))
    );

    if (eventDestinations.length === batchSize) {
      await reindexEventDestinationsManyQueue.add(
        { cursor: eventDestinations[eventDestinations.length - 1]!.id },
        hourlyPacedDelay()
      );
    }
  });
