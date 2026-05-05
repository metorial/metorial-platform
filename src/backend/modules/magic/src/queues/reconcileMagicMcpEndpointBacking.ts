import { createCron } from '@metorial/cron';
import { db } from '@metorial/db';
import { combineQueueProcessors, createQueue } from '@metorial/queue';
import {
  ensureMagicMcpEndpointBacking,
  magicMcpEndpointInclude
} from '../services/magicMcpEndpoint';

let BATCH_SIZE = 100;

export let reconcileMagicMcpEndpointBackingCron = createCron(
  {
    name: 'mgc/endpoint/backing/reconcile/cron',
    cron: process.env.NODE_ENV === 'production' ? '0 * * * *' : '* * * * *'
  },
  async () => {
    await reconcileMagicMcpEndpointBackingManyQueue.add({});
  }
);

export let reconcileMagicMcpEndpointBackingManyQueue = createQueue<{
  cursor?: string;
}>({
  name: 'mgc/endpoint/backing/reconcile/many'
});

export let reconcileMagicMcpEndpointBackingManyQueueProcessor =
  reconcileMagicMcpEndpointBackingManyQueue.process(async data => {
    let magicMcpEndpoints = await db.magicMcpEndpoint.findMany({
      where: {
        status: 'active',
        id: data.cursor ? { gt: data.cursor } : undefined,
        hasSubspaceBacking: false
      },
      select: { id: true },
      take: BATCH_SIZE,
      orderBy: { id: 'asc' }
    });

    if (magicMcpEndpoints.length === 0) return;

    await reconcileMagicMcpEndpointBackingSingleQueue.addMany(
      magicMcpEndpoints.map(magicMcpEndpoint => ({
        magicMcpEndpointId: magicMcpEndpoint.id
      }))
    );

    await reconcileMagicMcpEndpointBackingManyQueue.add({
      cursor: magicMcpEndpoints[magicMcpEndpoints.length - 1]!.id
    });
  });

export let reconcileMagicMcpEndpointBackingSingleQueue = createQueue<{
  magicMcpEndpointId: string;
}>({
  name: 'mgc/endpoint/backing/reconcile/single',
  workerOpts: {
    concurrency: 5
  }
});

export let reconcileMagicMcpEndpointBackingSingleQueueProcessor =
  reconcileMagicMcpEndpointBackingSingleQueue.process(async data => {
    let magicMcpEndpoint = await db.magicMcpEndpoint.findUnique({
      where: { id: data.magicMcpEndpointId },
      include: { ...magicMcpEndpointInclude, instance: true }
    });
    if (!magicMcpEndpoint || magicMcpEndpoint.status !== 'active') return;

    await ensureMagicMcpEndpointBacking({
      instance: magicMcpEndpoint.instance,
      endpoint: magicMcpEndpoint
    });
  });

export let reconcileMagicMcpEndpointBackingProcessors = combineQueueProcessors([
  reconcileMagicMcpEndpointBackingCron,
  reconcileMagicMcpEndpointBackingManyQueueProcessor,
  reconcileMagicMcpEndpointBackingSingleQueueProcessor
]);
