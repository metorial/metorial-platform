import { createCron } from '@metorial/cron';
import { db } from '@metorial/db';
import { combineQueueProcessors, createQueue, dailyPacedDelay } from '@metorial/queue';
import { ensureMagicMcpEndpointBacking, ensureMagicMcpServerBacking } from '../../lib/backing';

let BACKING_BACKFILL_BATCH_SIZE = 500;

let pendingBackingWhere = {
  status: 'active' as const,
  OR: [{ hasSubspaceBacking: false }, { isSubspaceBackingReconciling: true }]
};

// Servers and endpoints created by the previous queue-driven flow may still be unbacked or
// marked reconciling. New rows are always backed inline, so this drains to nothing.
export let magicMcpBackingBackfillCron = createCron(
  {
    name: 'magic/backing/backfill/cron',
    cron: '30 3 * * *'
  },
  async () => {
    await backfillMagicMcpServerBackingsManyQueue.add(
      {},
      { id: 'magic-server-backing-backfill' }
    );
    await backfillMagicMcpEndpointBackingsManyQueue.add(
      {},
      { id: 'magic-endpoint-backing-backfill' }
    );
  }
);

export let backfillMagicMcpServerBackingsManyQueue = createQueue<{ cursor?: string }>({
  name: 'magic/backing/backfill/server/many',
  workerOpts: { concurrency: 1 }
});

export let backfillMagicMcpServerBackingsManyQueueProcessor =
  backfillMagicMcpServerBackingsManyQueue.process(async data => {
    let servers = await db.magicMcpServer.findMany({
      where: {
        ...pendingBackingWhere,
        id: data.cursor ? { gt: data.cursor } : undefined
      },
      orderBy: { id: 'asc' },
      take: BACKING_BACKFILL_BATCH_SIZE,
      select: { id: true }
    });
    if (!servers.length) return;

    await backfillMagicMcpServerBackingQueue.addManyWithOps(
      servers.map(server => ({
        data: { magicMcpServerId: server.id },
        opts: { id: server.id }
      }))
    );

    if (servers.length === BACKING_BACKFILL_BATCH_SIZE) {
      await backfillMagicMcpServerBackingsManyQueue.add(
        { cursor: servers[servers.length - 1]!.id },
        dailyPacedDelay()
      );
    }
  });

export let backfillMagicMcpServerBackingQueue = createQueue<{ magicMcpServerId: string }>({
  name: 'magic/backing/backfill/server/single',
  workerOpts: { concurrency: 5, limiter: { max: 10, duration: 1000 } }
});

export let backfillMagicMcpServerBackingQueueProcessor =
  backfillMagicMcpServerBackingQueue.process(async data => {
    let server = await db.magicMcpServer.findUnique({
      where: { id: data.magicMcpServerId },
      include: { instance: true }
    });
    if (!server || server.status !== 'active') return;
    if (server.hasSubspaceBacking && !server.isSubspaceBackingReconciling) return;

    await ensureMagicMcpServerBacking({
      instance: server.instance,
      server,
      isReconciliation: true
    });
  });

export let backfillMagicMcpEndpointBackingsManyQueue = createQueue<{ cursor?: string }>({
  name: 'magic/backing/backfill/endpoint/many',
  workerOpts: { concurrency: 1 }
});

export let backfillMagicMcpEndpointBackingsManyQueueProcessor =
  backfillMagicMcpEndpointBackingsManyQueue.process(async data => {
    let endpoints = await db.magicMcpEndpoint.findMany({
      where: {
        ...pendingBackingWhere,
        id: data.cursor ? { gt: data.cursor } : undefined
      },
      orderBy: { id: 'asc' },
      take: BACKING_BACKFILL_BATCH_SIZE,
      select: { id: true }
    });
    if (!endpoints.length) return;

    await backfillMagicMcpEndpointBackingQueue.addManyWithOps(
      endpoints.map(endpoint => ({
        data: { magicMcpEndpointId: endpoint.id },
        opts: { id: endpoint.id }
      }))
    );

    if (endpoints.length === BACKING_BACKFILL_BATCH_SIZE) {
      await backfillMagicMcpEndpointBackingsManyQueue.add(
        { cursor: endpoints[endpoints.length - 1]!.id },
        dailyPacedDelay()
      );
    }
  });

export let backfillMagicMcpEndpointBackingQueue = createQueue<{ magicMcpEndpointId: string }>({
  name: 'magic/backing/backfill/endpoint/single',
  workerOpts: { concurrency: 5, limiter: { max: 10, duration: 1000 } }
});

export let backfillMagicMcpEndpointBackingQueueProcessor =
  backfillMagicMcpEndpointBackingQueue.process(async data => {
    let endpoint = await db.magicMcpEndpoint.findUnique({
      where: { id: data.magicMcpEndpointId },
      include: { instance: true }
    });
    if (!endpoint || endpoint.status !== 'active') return;
    if (endpoint.hasSubspaceBacking && !endpoint.isSubspaceBackingReconciling) return;

    await ensureMagicMcpEndpointBacking({
      instance: endpoint.instance,
      endpoint,
      isReconciliation: true
    });
  });

export let magicBackingBackfillQueueProcessor = combineQueueProcessors([
  magicMcpBackingBackfillCron,
  backfillMagicMcpServerBackingsManyQueueProcessor,
  backfillMagicMcpServerBackingQueueProcessor,
  backfillMagicMcpEndpointBackingsManyQueueProcessor,
  backfillMagicMcpEndpointBackingQueueProcessor
]);
