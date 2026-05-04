import { createCron } from '@metorial/cron';
import { db } from '@metorial/db';
import { combineQueueProcessors, createQueue } from '@metorial/queue';
import { ensureMagicMcpServerBacking } from '../services/magicMcpServer';

let BATCH_SIZE = 100;

export let reconcileMagicMcpServerBackingCron = createCron(
  {
    name: 'mgc/server/backing/reconcile/cron',
    cron: process.env.NODE_ENV === 'production' ? '0 * * * *' : '* * * * *'
  },
  async () => {
    await reconcileMagicMcpServerBackingManyQueue.add({});
  }
);

export let reconcileMagicMcpServerBackingManyQueue = createQueue<{
  cursor?: string;
}>({
  name: 'mgc/server/backing/reconcile/many'
});

export let reconcileMagicMcpServerBackingManyQueueProcessor =
  reconcileMagicMcpServerBackingManyQueue.process(async data => {
    let magicMcpServers = await db.magicMcpServer.findMany({
      where: {
        status: 'active',
        id: data.cursor ? { gt: data.cursor } : undefined,
        OR: [
          { hasSubspaceBacking: false },
          { newSubspaceSessionTemplateId: null },
          { subspaceEphemeralManagedSessionId: null }
        ]
      },
      select: { id: true },
      take: BATCH_SIZE,
      orderBy: { id: 'asc' }
    });

    if (magicMcpServers.length === 0) return;

    await reconcileMagicMcpServerBackingSingleQueue.addMany(
      magicMcpServers.map(magicMcpServer => ({
        magicMcpServerId: magicMcpServer.id
      }))
    );

    await reconcileMagicMcpServerBackingManyQueue.add({
      cursor: magicMcpServers[magicMcpServers.length - 1]!.id
    });
  });

export let reconcileMagicMcpServerBackingSingleQueue = createQueue<{
  magicMcpServerId: string;
}>({
  name: 'mgc/server/backing/reconcile/single',
  workerOpts: {
    concurrency: 5
  }
});

export let reconcileMagicMcpServerBackingSingleQueueProcessor =
  reconcileMagicMcpServerBackingSingleQueue.process(async data => {
    let magicMcpServer = await db.magicMcpServer.findUnique({
      where: { id: data.magicMcpServerId },
      include: { instance: true }
    });
    if (!magicMcpServer || magicMcpServer.status !== 'active') return;

    await ensureMagicMcpServerBacking({
      instance: magicMcpServer.instance,
      server: magicMcpServer
    });
  });

export let reconcileMagicMcpServerBackingProcessors = combineQueueProcessors([
  reconcileMagicMcpServerBackingCron,
  reconcileMagicMcpServerBackingManyQueueProcessor,
  reconcileMagicMcpServerBackingSingleQueueProcessor
]);
