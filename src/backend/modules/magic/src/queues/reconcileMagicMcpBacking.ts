import { createCron } from '@metorial/cron';
import { db, Prisma } from '@metorial/db';
import { combineQueueProcessors, createQueue } from '@metorial/queue';
import { ensureMagicMcpEndpointBacking, ensureMagicMcpServerBacking } from '../lib/backing';

let BATCH_SIZE = 100;

let needsReconciliationWhere = {
  status: 'active' as const,
  OR: [{ hasSubspaceBacking: false }, { subspaceEphemeralManagedSessionId: null }]
};

let magicMcpEndpointBackingInclude = {
  consumerProfile: true,
  servers: {
    include: {
      magicMcpServer: true
    }
  }
} satisfies Prisma.MagicMcpEndpointInclude;

export let reconcileMagicMcpBackingCron = createCron(
  {
    name: 'magic/mcp-backing/reconcile/cron',
    cron: '* * * * *'
  },
  async () => {
    await reconcileMagicMcpServersManyQueue.add({});
    await reconcileMagicMcpEndpointsManyQueue.add({});
  }
);

export let reconcileMagicMcpServersManyQueue = createQueue<{ cursor?: string }>({
  name: 'magic/mcp-backing/reconcile/servers/many',
  workerOpts: {
    concurrency: 2
  }
});

let reconcileMagicMcpServersManyQueueProcessor = reconcileMagicMcpServersManyQueue.process(
  async data => {
    let servers = await db.magicMcpServer.findMany({
      where: {
        id: data.cursor ? { gt: data.cursor } : undefined,
        ...needsReconciliationWhere
      },
      take: BATCH_SIZE,
      orderBy: {
        id: 'asc'
      },
      select: {
        id: true
      }
    });

    if (servers.length === 0) return;

    await reconcileMagicMcpServersSingleQueue.addManyWithOps(
      servers.map(server => ({
        data: { magicMcpServerId: server.id },
        opts: { id: server.id }
      }))
    );

    await reconcileMagicMcpServersManyQueue.add({
      cursor: servers[servers.length - 1]!.id
    });
  }
);

export let reconcileMagicMcpServersSingleQueue = createQueue<{
  magicMcpServerId: string;
}>({
  name: 'magic/mcp-backing/reconcile/servers/single',
  workerOpts: {
    concurrency: 5,
    limiter: {
      max: 5,
      duration: 1000
    }
  }
});

let reconcileMagicMcpServersSingleQueueProcessor = reconcileMagicMcpServersSingleQueue.process(
  async data => {
    let server = await db.magicMcpServer.findUnique({
      where: {
        id: data.magicMcpServerId
      },
      include: {
        instance: true
      }
    });
    if (!server || server.status !== 'active') return;
    if (server.hasSubspaceBacking && server.subspaceEphemeralManagedSessionId) return;

    await ensureMagicMcpServerBacking({
      instance: server.instance,
      server,
      isReconciliation: true
    });
  }
);

export let reconcileMagicMcpEndpointsManyQueue = createQueue<{ cursor?: string }>({
  name: 'magic/mcp-backing/reconcile/endpoints/many',
  workerOpts: {
    concurrency: 2
  }
});

let reconcileMagicMcpEndpointsManyQueueProcessor = reconcileMagicMcpEndpointsManyQueue.process(
  async data => {
    let endpoints = await db.magicMcpEndpoint.findMany({
      where: {
        id: data.cursor ? { gt: data.cursor } : undefined,
        ...needsReconciliationWhere
      },
      take: BATCH_SIZE,
      orderBy: {
        id: 'asc'
      },
      select: {
        id: true
      }
    });

    if (endpoints.length === 0) return;

    await reconcileMagicMcpEndpointsSingleQueue.addManyWithOps(
      endpoints.map(endpoint => ({
        data: { magicMcpEndpointId: endpoint.id },
        opts: { id: endpoint.id }
      }))
    );

    await reconcileMagicMcpEndpointsManyQueue.add({
      cursor: endpoints[endpoints.length - 1]!.id
    });
  }
);

export let reconcileMagicMcpEndpointsSingleQueue = createQueue<{
  magicMcpEndpointId: string;
}>({
  name: 'magic/mcp-backing/reconcile/endpoints/single',
  workerOpts: {
    concurrency: 5,
    limiter: {
      max: 5,
      duration: 1000
    }
  }
});

let reconcileMagicMcpEndpointsSingleQueueProcessor =
  reconcileMagicMcpEndpointsSingleQueue.process(async data => {
    let endpoint = await db.magicMcpEndpoint.findUnique({
      where: {
        id: data.magicMcpEndpointId
      },
      include: {
        instance: true,
        ...magicMcpEndpointBackingInclude
      }
    });
    if (!endpoint || endpoint.status !== 'active') return;
    if (endpoint.hasSubspaceBacking && endpoint.subspaceEphemeralManagedSessionId) return;

    await ensureMagicMcpEndpointBacking({
      instance: endpoint.instance,
      endpoint,
      isReconciliation: true
    });
  });

export let reconcileMagicMcpBackingProcessors = combineQueueProcessors([
  reconcileMagicMcpBackingCron,
  reconcileMagicMcpServersManyQueueProcessor,
  reconcileMagicMcpServersSingleQueueProcessor,
  reconcileMagicMcpEndpointsManyQueueProcessor,
  reconcileMagicMcpEndpointsSingleQueueProcessor
]);
