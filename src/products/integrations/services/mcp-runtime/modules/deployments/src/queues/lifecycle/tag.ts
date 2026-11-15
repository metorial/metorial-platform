import { createQueue, QueueRetryError } from '@lowerdeck/queue';
import { db } from '@mtsrc/mcp-runtime-db';
import { env } from '@mtsrc/mcp-runtime-env';
import { syncTagQueue } from '../tag/sync';

export let repositoryTagCreatedQueue = createQueue<{
  tagId: string;
  serverDeploymentId: string | undefined;
}>({
  name: 'shut/l/rep-tag/created',
  workerOpts: { concurrency: 10 },
  redisUrl: env.service.REDIS_URL
});

export let repositoryTagCreatedQueueProcessor = repositoryTagCreatedQueue.process(
  async data => {
    let tag = await db.containerRepositoryTag.findFirst({
      where: { id: data.tagId }
    });
    if (!tag) throw new QueueRetryError();

    await syncTagQueue.add({ tagId: tag.id, serverDeploymentId: data.serverDeploymentId });
  }
);
