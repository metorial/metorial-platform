import { createCron } from '@lowerdeck/cron';
import { combineQueueProcessors, createQueue, dailyPacedDelay } from '@lowerdeck/queue';
import { db } from '@metorial-subspace/db';
import { metorialDb } from '@metorial-subspace/module-tenant';
import { env } from '../../env';
import { identityActorMirrorService } from '../../services/identityActorMirror';

let MIRROR_RECONCILE_BATCH_SIZE = 500;

export let mirrorIdentityActorQueue = createQueue<{ identityActorId: string }>({
  name: 'sub/idn/mirror/identityActor',
  redisUrl: env.service.REDIS_URL,
  workerOpts: { concurrency: 5, limiter: { max: 20, duration: 1000 } }
});

export let mirrorIdentityActorQueueProcessor = mirrorIdentityActorQueue.process(async data => {
  await identityActorMirrorService.syncIdentityActor({
    identityActorId: data.identityActorId
  });
});

export let mirrorAgentQueue = createQueue<{ agentId: string }>({
  name: 'sub/idn/mirror/agent',
  redisUrl: env.service.REDIS_URL,
  workerOpts: { concurrency: 5, limiter: { max: 20, duration: 1000 } }
});

export let mirrorAgentQueueProcessor = mirrorAgentQueue.process(async data => {
  await identityActorMirrorService.syncAgent({ agentId: data.agentId });
});

export let mirrorReconcileCron = createCron(
  {
    name: 'sub/idn/cron/mirrorReconcile',
    cron: '0 2 * * *',
    redisUrl: env.service.REDIS_URL
  },
  async () => {
    await mirrorIdentityActorsManyQueue.add({});
    await mirrorAgentsManyQueue.add({});
    await mirrorRemovedIdentityActorsManyQueue.add({});
    await mirrorRemovedAgentsManyQueue.add({});
  }
);

export let mirrorIdentityActorsManyQueue = createQueue<{ cursor?: string }>({
  name: 'sub/idn/mirror/identityActor/many',
  redisUrl: env.service.REDIS_URL,
  workerOpts: { concurrency: 1 }
});

export let mirrorIdentityActorsManyQueueProcessor = mirrorIdentityActorsManyQueue.process(
  async data => {
    let identityActors = await db.identityActor.findMany({
      where: { id: data.cursor ? { gt: data.cursor } : undefined },
      orderBy: { id: 'asc' },
      take: MIRROR_RECONCILE_BATCH_SIZE,
      select: { id: true }
    });
    if (!identityActors.length) return;

    await mirrorIdentityActorQueue.addManyWithOps(
      identityActors.map(identityActor => ({
        data: { identityActorId: identityActor.id },
        opts: { id: identityActor.id }
      }))
    );

    if (identityActors.length === MIRROR_RECONCILE_BATCH_SIZE) {
      await mirrorIdentityActorsManyQueue.add(
        { cursor: identityActors[identityActors.length - 1]!.id },
        dailyPacedDelay()
      );
    }
  }
);

export let mirrorAgentsManyQueue = createQueue<{ cursor?: string }>({
  name: 'sub/idn/mirror/agent/many',
  redisUrl: env.service.REDIS_URL,
  workerOpts: { concurrency: 1 }
});

export let mirrorAgentsManyQueueProcessor = mirrorAgentsManyQueue.process(async data => {
  let agents = await db.agent.findMany({
    where: { id: data.cursor ? { gt: data.cursor } : undefined },
    orderBy: { id: 'asc' },
    take: MIRROR_RECONCILE_BATCH_SIZE,
    select: { id: true }
  });
  if (!agents.length) return;

  await mirrorAgentQueue.addManyWithOps(
    agents.map(agent => ({
      data: { agentId: agent.id },
      opts: { id: agent.id }
    }))
  );

  if (agents.length === MIRROR_RECONCILE_BATCH_SIZE) {
    await mirrorAgentsManyQueue.add(
      { cursor: agents[agents.length - 1]!.id },
      dailyPacedDelay()
    );
  }
});

export let mirrorRemovedIdentityActorsManyQueue = createQueue<{ cursor?: string }>({
  name: 'sub/idn/mirror/identityActor/removed/many',
  redisUrl: env.service.REDIS_URL,
  workerOpts: { concurrency: 1 }
});

export let mirrorRemovedIdentityActorsManyQueueProcessor =
  mirrorRemovedIdentityActorsManyQueue.process(async data => {
    let mirroredActors = await metorialDb.identityActor.findMany({
      where: {
        status: { not: 'deleted' },
        id: data.cursor ? { gt: data.cursor } : undefined
      },
      orderBy: { id: 'asc' },
      take: MIRROR_RECONCILE_BATCH_SIZE,
      select: { id: true }
    });
    if (!mirroredActors.length) return;

    let existingActors = await db.identityActor.findMany({
      where: { id: { in: mirroredActors.map(actor => actor.id) } },
      select: { id: true }
    });
    let existingActorIds = new Set(existingActors.map(actor => actor.id));
    let removedActors = mirroredActors.filter(actor => !existingActorIds.has(actor.id));

    await mirrorIdentityActorQueue.addManyWithOps(
      removedActors.map(actor => ({
        data: { identityActorId: actor.id },
        opts: { id: actor.id }
      }))
    );

    if (mirroredActors.length === MIRROR_RECONCILE_BATCH_SIZE) {
      await mirrorRemovedIdentityActorsManyQueue.add(
        { cursor: mirroredActors[mirroredActors.length - 1]!.id },
        dailyPacedDelay()
      );
    }
  });

export let mirrorRemovedAgentsManyQueue = createQueue<{ cursor?: string }>({
  name: 'sub/idn/mirror/agent/removed/many',
  redisUrl: env.service.REDIS_URL,
  workerOpts: { concurrency: 1 }
});

export let mirrorRemovedAgentsManyQueueProcessor = mirrorRemovedAgentsManyQueue.process(
  async data => {
    let mirroredAgents = await metorialDb.agent.findMany({
      where: {
        status: { not: 'deleted' },
        id: data.cursor ? { gt: data.cursor } : undefined
      },
      orderBy: { id: 'asc' },
      take: MIRROR_RECONCILE_BATCH_SIZE,
      select: { id: true }
    });
    if (!mirroredAgents.length) return;

    let existingAgents = await db.agent.findMany({
      where: { id: { in: mirroredAgents.map(agent => agent.id) } },
      select: { id: true }
    });
    let existingAgentIds = new Set(existingAgents.map(agent => agent.id));
    let removedAgents = mirroredAgents.filter(agent => !existingAgentIds.has(agent.id));

    await mirrorAgentQueue.addManyWithOps(
      removedAgents.map(agent => ({
        data: { agentId: agent.id },
        opts: { id: agent.id }
      }))
    );

    if (mirroredAgents.length === MIRROR_RECONCILE_BATCH_SIZE) {
      await mirrorRemovedAgentsManyQueue.add(
        { cursor: mirroredAgents[mirroredAgents.length - 1]!.id },
        dailyPacedDelay()
      );
    }
  }
);

export let mirrorQueues = combineQueueProcessors([
  mirrorIdentityActorQueueProcessor,
  mirrorAgentQueueProcessor,
  mirrorReconcileCron,
  mirrorIdentityActorsManyQueueProcessor,
  mirrorAgentsManyQueueProcessor,
  mirrorRemovedIdentityActorsManyQueueProcessor,
  mirrorRemovedAgentsManyQueueProcessor
]);
