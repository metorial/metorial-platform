import { createCron } from '@lowerdeck/cron';
import { combineQueueProcessors, createQueue } from '@lowerdeck/queue';
import { db, getId } from '@metorial-subspace/db';
import { subMinutes } from 'date-fns';
import { env } from '../../env';

let expireSessionConnectionsCron = createCron(
  {
    name: 'sub/con/conn/expire/cron',
    cron: '* * * * *',
    redisUrl: env.service.REDIS_URL
  },
  async () => {
    await expireSessionConnectionsQueue.add({});
  }
);

let expireSessionConnectionsQueue = createQueue<{ cursor?: string }>({
  name: 'sub/con/conn/expire/many',
  redisUrl: env.service.REDIS_URL
});

let expireSessionConnectionsQueueProcessor = expireSessionConnectionsQueue.process(
  async data => {
    let twoMinutesAgo = subMinutes(new Date(), 2);

    let connections = await db.sessionConnection.findMany({
      where: {
        state: 'connected',
        lastActiveAt: { lt: twoMinutesAgo },
        id: data.cursor ? { gt: data.cursor } : undefined
      },
      orderBy: { id: 'asc' },
      take: 100,
      select: { id: true }
    });
    if (connections.length === 0) return;

    await expireSessionConnectionQueue.addMany(
      connections.map(conn => ({ connectionId: conn.id }))
    );

    let lastConnection = connections[connections.length - 1];
    await expireSessionConnectionsQueue.add({ cursor: lastConnection!.id });
  }
);

let expireSessionConnectionQueue = createQueue<{ connectionId: string }>({
  name: 'sub/con/conn/expire/single',
  redisUrl: env.service.REDIS_URL
});

let expireSessionConnectionQueueProcessor = expireSessionConnectionQueue.process(
  async data => {
    let connection = await db.sessionConnection.findUnique({
      where: { id: data.connectionId }
    });
    if (!connection || connection.state !== 'connected') return;

    await db.sessionConnection.updateMany({
      where: { id: connection.id },
      data: {
        state: 'disconnected',
        disconnectedAt: new Date()
      }
    });

    await db.sessionEvent.createMany({
      data: {
        ...getId('sessionEvent'),
        type: 'connection_disconnected',
        sessionOid: connection.sessionOid,
        connectionOid: connection.oid,
        tenantOid: connection.tenantOid,
        solutionOid: connection.solutionOid,
        environmentOid: connection.environmentOid
      }
    });
  }
);

export let expireSessionConnectionsQueues = combineQueueProcessors([
  expireSessionConnectionsCron,
  expireSessionConnectionsQueueProcessor,
  expireSessionConnectionQueueProcessor
]);
