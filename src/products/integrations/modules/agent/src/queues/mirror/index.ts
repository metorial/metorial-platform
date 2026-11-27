import { createCron } from '@lowerdeck/cron';
import { combineQueueProcessors, createQueue, dailyPacedDelay } from '@lowerdeck/queue';
import { db } from '@metorial-subspace/db';
import { metorialDb } from '@metorial-subspace/module-tenant';
import { env } from '../../env';
import { agentMirrorService } from '../../internal/agentMirror';

let MIRROR_RECONCILE_BATCH_SIZE = 500;

let singleWorkerOpts = { concurrency: 5, limiter: { max: 20, duration: 1000 } };

export let mirrorAgentClientQueue = createQueue<{ agentClientId: string }>({
  name: 'sub/agt/mirror/client',
  redisUrl: env.service.REDIS_URL,
  workerOpts: singleWorkerOpts
});

export let mirrorAgentClientQueueProcessor = mirrorAgentClientQueue.process(async data => {
  await agentMirrorService.syncAgentClient({ agentClientId: data.agentClientId });
});

export let mirrorAgentInstanceQueue = createQueue<{ agentInstanceId: string }>({
  name: 'sub/agt/mirror/instance',
  redisUrl: env.service.REDIS_URL,
  workerOpts: singleWorkerOpts
});

export let mirrorAgentInstanceQueueProcessor = mirrorAgentInstanceQueue.process(async data => {
  await agentMirrorService.syncAgentInstance({ agentInstanceId: data.agentInstanceId });
});

export let mirrorAgentReconcileCron = createCron(
  {
    name: 'sub/agt/cron/mirrorReconcile',
    cron: '0 4 * * *',
    redisUrl: env.service.REDIS_URL
  },
  async () => {
    await mirrorAgentClientsManyQueue.add({});
    await mirrorAgentInstancesManyQueue.add({});
    await mirrorRemovedAgentClientsManyQueue.add({});
    await mirrorRemovedAgentInstancesManyQueue.add({});
  }
);

export let mirrorAgentClientsManyQueue = createQueue<{ cursor?: string }>({
  name: 'sub/agt/mirror/client/many',
  redisUrl: env.service.REDIS_URL,
  workerOpts: { concurrency: 1 }
});

export let mirrorAgentClientsManyQueueProcessor = mirrorAgentClientsManyQueue.process(
  async data => {
    let agentClients = await db.agentClient.findMany({
      where: { id: data.cursor ? { gt: data.cursor } : undefined },
      orderBy: { id: 'asc' },
      take: MIRROR_RECONCILE_BATCH_SIZE,
      select: { id: true }
    });
    if (!agentClients.length) return;

    await mirrorAgentClientQueue.addManyWithOps(
      agentClients.map(agentClient => ({
        data: { agentClientId: agentClient.id },
        opts: { id: agentClient.id }
      }))
    );

    if (agentClients.length === MIRROR_RECONCILE_BATCH_SIZE) {
      await mirrorAgentClientsManyQueue.add(
        { cursor: agentClients[agentClients.length - 1]!.id },
        dailyPacedDelay()
      );
    }
  }
);

export let mirrorAgentInstancesManyQueue = createQueue<{ cursor?: string }>({
  name: 'sub/agt/mirror/instance/many',
  redisUrl: env.service.REDIS_URL,
  workerOpts: { concurrency: 1 }
});

export let mirrorAgentInstancesManyQueueProcessor = mirrorAgentInstancesManyQueue.process(
  async data => {
    let agentInstances = await db.agentInstance.findMany({
      where: { id: data.cursor ? { gt: data.cursor } : undefined },
      orderBy: { id: 'asc' },
      take: MIRROR_RECONCILE_BATCH_SIZE,
      select: { id: true }
    });
    if (!agentInstances.length) return;

    await mirrorAgentInstanceQueue.addManyWithOps(
      agentInstances.map(agentInstance => ({
        data: { agentInstanceId: agentInstance.id },
        opts: { id: agentInstance.id }
      }))
    );

    if (agentInstances.length === MIRROR_RECONCILE_BATCH_SIZE) {
      await mirrorAgentInstancesManyQueue.add(
        { cursor: agentInstances[agentInstances.length - 1]!.id },
        dailyPacedDelay()
      );
    }
  }
);

export let mirrorRemovedAgentClientsManyQueue = createQueue<{ cursor?: string }>({
  name: 'sub/agt/mirror/client/removed/many',
  redisUrl: env.service.REDIS_URL,
  workerOpts: { concurrency: 1 }
});

export let mirrorRemovedAgentClientsManyQueueProcessor =
  mirrorRemovedAgentClientsManyQueue.process(async data => {
    let mirroredClients = await metorialDb.agentClient.findMany({
      where: { id: data.cursor ? { gt: data.cursor } : undefined },
      orderBy: { id: 'asc' },
      take: MIRROR_RECONCILE_BATCH_SIZE,
      select: { id: true }
    });
    if (!mirroredClients.length) return;

    let existingClients = await db.agentClient.findMany({
      where: { id: { in: mirroredClients.map(client => client.id) } },
      select: { id: true }
    });
    let existingClientIds = new Set(existingClients.map(client => client.id));
    let removedClients = mirroredClients.filter(client => !existingClientIds.has(client.id));

    await mirrorAgentClientQueue.addManyWithOps(
      removedClients.map(client => ({
        data: { agentClientId: client.id },
        opts: { id: client.id }
      }))
    );

    if (mirroredClients.length === MIRROR_RECONCILE_BATCH_SIZE) {
      await mirrorRemovedAgentClientsManyQueue.add(
        { cursor: mirroredClients[mirroredClients.length - 1]!.id },
        dailyPacedDelay()
      );
    }
  });

export let mirrorRemovedAgentInstancesManyQueue = createQueue<{ cursor?: string }>({
  name: 'sub/agt/mirror/instance/removed/many',
  redisUrl: env.service.REDIS_URL,
  workerOpts: { concurrency: 1 }
});

export let mirrorRemovedAgentInstancesManyQueueProcessor =
  mirrorRemovedAgentInstancesManyQueue.process(async data => {
    let mirroredInstances = await metorialDb.agentInstance.findMany({
      where: { id: data.cursor ? { gt: data.cursor } : undefined },
      orderBy: { id: 'asc' },
      take: MIRROR_RECONCILE_BATCH_SIZE,
      select: { id: true }
    });
    if (!mirroredInstances.length) return;

    let existingInstances = await db.agentInstance.findMany({
      where: { id: { in: mirroredInstances.map(instance => instance.id) } },
      select: { id: true }
    });
    let existingInstanceIds = new Set(existingInstances.map(instance => instance.id));
    let removedInstances = mirroredInstances.filter(
      instance => !existingInstanceIds.has(instance.id)
    );

    await mirrorAgentInstanceQueue.addManyWithOps(
      removedInstances.map(instance => ({
        data: { agentInstanceId: instance.id },
        opts: { id: instance.id }
      }))
    );

    if (mirroredInstances.length === MIRROR_RECONCILE_BATCH_SIZE) {
      await mirrorRemovedAgentInstancesManyQueue.add(
        { cursor: mirroredInstances[mirroredInstances.length - 1]!.id },
        dailyPacedDelay()
      );
    }
  });

export let mirrorQueues = combineQueueProcessors([
  mirrorAgentClientQueueProcessor,
  mirrorAgentInstanceQueueProcessor,
  mirrorAgentReconcileCron,
  mirrorAgentClientsManyQueueProcessor,
  mirrorAgentInstancesManyQueueProcessor,
  mirrorRemovedAgentClientsManyQueueProcessor,
  mirrorRemovedAgentInstancesManyQueueProcessor
]);
