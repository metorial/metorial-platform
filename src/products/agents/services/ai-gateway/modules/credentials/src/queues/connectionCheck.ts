import { createCron } from '@lowerdeck/cron';
import { combineQueueProcessors, createQueue, hourlyPacedDelay } from '@lowerdeck/queue';
import { db } from '@mtsrc/ai-gateway-db';
import { env } from '../env';
import { recheckConnection } from '../lib/check';
import { connectionInclude } from '../lib/connection';
import type { ConnectionCheckTrigger } from '../lib/history';

let pageSize = 500;

export let connectionCheckCron = createCron(
  {
    name: 'aig/connection/check/cron',
    cron: '*/5 * * * *',
    redisUrl: env.service.REDIS_URL
  },
  async () => {
    await connectionCheckManyQueue.add({});
  }
);

export let connectionCheckManyQueue = createQueue<{ cursor?: string }>({
  name: 'aig/connection/check/many',
  redisUrl: env.service.REDIS_URL,
  workerOpts: { concurrency: 1 }
});

export let connectionCheckManyProcessor = connectionCheckManyQueue.process(async data => {
  let connections = await db.providerConnection.findMany({
    where: {
      archivedAt: null,
      status: { not: 'disabled' },
      nextCheckAt: { lte: new Date() },
      id: data.cursor ? { gt: data.cursor } : undefined
    },
    orderBy: { id: 'asc' },
    take: pageSize,
    select: { id: true, nextCheckAt: true }
  });

  if (!connections.length) return;

  await connectionCheckSingleQueue.addManyWithOps(
    connections.map(connection => ({
      data: { connectionId: connection.id, trigger: 'scheduled' as const },
      opts: { id: `${connection.id}:${connection.nextCheckAt!.getTime()}` }
    }))
  );

  if (connections.length == pageSize) {
    await connectionCheckManyQueue.add(
      { cursor: connections[connections.length - 1]!.id },
      hourlyPacedDelay()
    );
  }
});

export let connectionCheckSingleQueue = createQueue<{
  connectionId: string;
  trigger: ConnectionCheckTrigger;
}>({
  name: 'aig/connection/check/single',
  redisUrl: env.service.REDIS_URL,
  workerOpts: { concurrency: 5, limiter: { max: 10, duration: 1000 } }
});

export let connectionCheckSingleProcessor = connectionCheckSingleQueue.process(async data => {
  let connection = await db.providerConnection.findUnique({
    where: { id: data.connectionId },
    include: connectionInclude
  });
  if (!connection) return;

  if (
    data.trigger == 'scheduled' &&
    (!connection.nextCheckAt || connection.nextCheckAt > new Date())
  ) {
    return;
  }

  await recheckConnection({ connection, trigger: data.trigger });
});

export let connectionCheckProcessor = combineQueueProcessors([
  connectionCheckCron,
  connectionCheckManyProcessor,
  connectionCheckSingleProcessor
]);
