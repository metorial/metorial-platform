import { createQueue } from '@lowerdeck/queue';
import { env } from '../../env';

export let skillTemplateCreatedQueue = createQueue<{ skillTemplateId: string }>({
  name: 'sub/sk/lc/skillTemplate/created',
  redisUrl: env.service.REDIS_URL
});
export let skillTemplateUpdatedQueue = createQueue<{ skillTemplateId: string }>({
  name: 'sub/sk/lc/skillTemplate/updated',
  redisUrl: env.service.REDIS_URL
});
export let skillTemplateArchivedQueue = createQueue<{ skillTemplateId: string }>({
  name: 'sub/sk/lc/skillTemplate/archived',
  redisUrl: env.service.REDIS_URL
});

export let skillTemplateCreatedQueueProcessor =
  skillTemplateCreatedQueue.process(async () => {});
export let skillTemplateUpdatedQueueProcessor =
  skillTemplateUpdatedQueue.process(async () => {});
export let skillTemplateArchivedQueueProcessor =
  skillTemplateArchivedQueue.process(async () => {});
