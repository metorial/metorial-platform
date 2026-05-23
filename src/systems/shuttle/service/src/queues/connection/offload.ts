import { createCron } from '@mtsrc/cron';
import { delay } from '@mtsrc/delay';
import { createQueue, QueueRetryError } from '@mtsrc/queue';
import { db } from '../../db';
import { env } from '../../env';
import { offload } from '../../lib/offload';
import { connectionLogsBucketRecord } from '../../storage';

export let offloadConnectionLogsCron = createCron(
  {
    name: 'shut/con-log/offload/cron',
    redisUrl: env.service.REDIS_URL,
    cron: '0 * * * *'
  },
  async () => {
    await offloadConnectionLogsQueue.add({});
  }
);

export let offloadConnectionLogsQueue = createQueue<{ cursor?: string }>({
  name: 'shut/con-log/offload/many',
  redisUrl: env.service.REDIS_URL
});

export let offloadConnectionLogsQueueProcessor = offloadConnectionLogsQueue.process(
  async data => {
    let connections = await db.serverConnection.findMany({
      where: {
        status: 'disconnected',
        isLogsInStorage: false,
        id: data.cursor ? { gt: data.cursor } : undefined
      },
      take: 100,
      orderBy: { id: 'asc' },
      select: { id: true }
    });
    if (connections.length === 0) return;

    await offloadConnectionLogQueue.addManyWithOps(
      connections.map(c => ({
        data: { serverConnectionId: c.id },
        opts: { id: c.id }
      }))
    );

    await offloadConnectionLogsQueue.add({ cursor: connections[connections.length - 1]!.id });
  }
);

export let offloadConnectionLogQueue = createQueue<{ serverConnectionId: string }>({
  name: 'shut/con-log/offload',
  redisUrl: env.service.REDIS_URL
});

export let offloadConnectionLogQueueProcessor = offloadConnectionLogQueue.process(
  async data => {
    let connection = await db.serverConnection.findUnique({
      where: { id: data.serverConnectionId }
    });
    if (!connection) throw new QueueRetryError();
    if (connection.status != 'disconnected') return;

    let logs = await db.serverConnectionLogsTemp.findMany({
      where: { serverConnectionOid: connection.oid }
    });

    await offload.offloadConnectionLogs(
      connection,
      logs.flatMap(l => l.logLines)
    );

    await delay(1000 * 5);

    await db.serverConnection.update({
      where: { oid: connection.oid },
      data: {
        isLogsInStorage: true,
        logBucketOid: connectionLogsBucketRecord.oid
      }
    });
  }
);
