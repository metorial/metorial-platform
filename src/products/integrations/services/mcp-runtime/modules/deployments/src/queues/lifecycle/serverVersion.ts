import { createQueue, QueueRetryError } from '@lowerdeck/queue';
import { db } from '@mtsrc/mcp-runtime-db';
import { env } from '@mtsrc/mcp-runtime-env';
import { withTransaction } from '@mtsrc/mcp-runtime-db';
import { createChangeNotificationQueue } from '@mtsrc/mcp-runtime-module-change-notifications';

export let serverVersionCreatedQueue = createQueue<{ serverVersionId: string }>({
  name: 'shut/l/serverVersion/created',
  redisUrl: env.service.REDIS_URL,
  workerOpts: {
    concurrency: 3,
    limiter: {
      max: 30,
      duration: 1000
    }
  }
});

export let serverVersionCreatedQueueProcessor = serverVersionCreatedQueue.process(
  async data => {
    let serverVersion = await db.serverVersion.findFirst({
      where: { id: data.serverVersionId },
      include: { repositoryTag: { include: { currentVersion: true } }, server: true }
    });
    if (!serverVersion) throw new QueueRetryError();

    await withTransaction(async db => {
      await db.serverVersion.updateMany({
        where: {
          serverOid: serverVersion.serverOid,
          isCurrent: true,
          oid: { not: serverVersion.oid }
        },
        data: {
          isCurrent: false
        }
      });

      await db.serverVersion.update({
        where: { oid: serverVersion.oid },
        data: {
          isCurrent: true,
          tenantOid: serverVersion.server.tenantOid
        }
      });

      await db.server.updateMany({
        where: { oid: serverVersion.serverOid },
        data: {
          currentVersionOid: serverVersion.oid
        }
      });
    });

    await createChangeNotificationQueue.add({
      serverVersionId: serverVersion.id
    });
  }
);
