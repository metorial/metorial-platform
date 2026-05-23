import { createQueue } from '@mtsrc/queue';
import { db } from '../../db';
import { env } from '../../env';
import { getId } from '../../id';

export let createChangeNotificationQueue = createQueue<{
  serverVersionId: string;
}>({
  name: 'shut/cnotf/crea',
  redisUrl: env.service.REDIS_URL,
  workerOpts: { concurrency: 2 }
});

export let createChangeNotificationQueueProcessor = createChangeNotificationQueue.process(
  async data => {
    let serverVersion = await db.serverVersion.findUnique({
      where: { id: data.serverVersionId }
    });
    if (!serverVersion) return;

    await db.changeNotification.createMany({
      data: {
        ...getId('changeNotification'),
        serverOid: serverVersion.serverOid,
        serverVersionOid: serverVersion.oid,
        type: serverVersion.tenantOid
          ? 'private_server_version_created'
          : 'public_server_version_created'
      }
    });
  }
);
