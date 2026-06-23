import { createQueue, QueueRetryError } from '@lowerdeck/queue';
import { db } from '../../db';
import { env } from '../../env';
import { syncTagQueue } from '../tag/sync';

export let repositoryTagCreatedQueue = createQueue<{
  tagId: string;
  serverDeploymentId: string | undefined;
}>({
  name: 'shut/l/rep-tag/created',
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
