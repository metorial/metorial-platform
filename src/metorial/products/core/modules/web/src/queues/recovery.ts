import { createCron } from '@metorial/cron';
import { db } from '@metorial/db';
import { combineQueueProcessors, createQueue, hourlyPacedDelay } from '@metorial/queue';
import { runDiscoveryQueue } from './discovery';

let RECOVERY_BATCH_SIZE = 500;
let PENDING_STALE_MS = 15 * 60 * 1000;

export let recoverDiscoveriesManyQueue = createQueue<{ cursor?: string }>({
  name: 'web/discovery/recover/many',
  workerOpts: { concurrency: 1 }
});

export let recoverDiscoveriesManyProcessor = recoverDiscoveriesManyQueue.process(
  async data => {
    let now = new Date();

    let stuck = await db.webDiscovery.findMany({
      where: {
        OR: [
          { status: 'pending', startedAt: { lt: new Date(now.getTime() - PENDING_STALE_MS) } },
          { status: 'running', leaseExpiresAt: { lt: now } }
        ],
        id: data.cursor ? { gt: data.cursor } : undefined
      },
      orderBy: { id: 'asc' },
      take: RECOVERY_BATCH_SIZE,
      select: { id: true }
    });
    if (stuck.length === 0) return;

    await runDiscoveryQueue.addMany(stuck.map(discovery => ({ discoveryId: discovery.id })));

    if (stuck.length === RECOVERY_BATCH_SIZE) {
      await recoverDiscoveriesManyQueue.add(
        { cursor: stuck[stuck.length - 1]!.id },
        hourlyPacedDelay()
      );
    }
  }
);

export let recoverDiscoveriesCron = createCron(
  { name: 'web/discovery/recover/cron', cron: '*/5 * * * *' },
  async () => {
    await recoverDiscoveriesManyQueue.add({});
  }
);

export let recoverDiscoveriesProcessors = combineQueueProcessors([
  recoverDiscoveriesCron,
  recoverDiscoveriesManyProcessor
]);
