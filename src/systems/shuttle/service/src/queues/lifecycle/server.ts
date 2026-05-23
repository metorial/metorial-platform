import { createQueue } from '@mtsrc/queue';
import { env } from '../../env';

export let serverCreatedQueue = createQueue<{ serverId: string }>({
  name: 'shut/l/server/created',
  redisUrl: env.service.REDIS_URL
});

export let serverCreatedQueueProcessor = serverCreatedQueue.process(async data => {
  // let server = await db.server.findFirst({
  //   where: { id: data.serverId },
  //   include: { draftRepositoryTag: { include: { currentVersion: true } } }
  // });
  // if (!server) throw new QueueRetryError();
});

export let serverUpdatedQueue = createQueue<{ serverId: string }>({
  name: 'shut/l/server/updated',
  redisUrl: env.service.REDIS_URL
});

export let serverUpdatedQueueProcessor = serverUpdatedQueue.process(async data => {
  // let server = await db.server.findFirst({
  //   where: { id: data.serverId },
  //   include: { draftRepositoryTag: { include: { currentVersion: true } } }
  // });
  // if (!server) throw new QueueRetryError();
});
