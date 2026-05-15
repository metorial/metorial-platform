import { createQueue, QueueRetryError } from '@lowerdeck/queue';
import { db } from '@metorial-subspace/db';
import { env } from '../../env';
import { indexSkillTemplateQueue } from '../search/skillTemplate';

export let skillTemplateCreatedQueue = createQueue<{ skillTemplateId: string }>({
  name: 'sub/sk/lc/skillTemplate/created',
  redisUrl: env.service.REDIS_URL
});

export let skillTemplateCreatedQueueProcessor = skillTemplateCreatedQueue.process(async data => {
  let skillTemplate = await db.skillTemplate.findUnique({
    where: { id: data.skillTemplateId }
  });
  if (!skillTemplate) throw new QueueRetryError();

  await indexSkillTemplateQueue.add({ skillTemplateId: skillTemplate.id });
});

export let skillTemplateUpdatedQueue = createQueue<{ skillTemplateId: string }>({
  name: 'sub/sk/lc/skillTemplate/updated',
  redisUrl: env.service.REDIS_URL
});

export let skillTemplateUpdatedQueueProcessor = skillTemplateUpdatedQueue.process(async data => {
  let skillTemplate = await db.skillTemplate.findUnique({
    where: { id: data.skillTemplateId }
  });
  if (!skillTemplate) throw new QueueRetryError();

  await indexSkillTemplateQueue.add({ skillTemplateId: skillTemplate.id });
});

export let skillTemplateArchivedQueue = createQueue<{ skillTemplateId: string }>({
  name: 'sub/sk/lc/skillTemplate/archived',
  redisUrl: env.service.REDIS_URL
});

export let skillTemplateArchivedQueueProcessor = skillTemplateArchivedQueue.process(async data => {
  let skillTemplate = await db.skillTemplate.findUnique({
    where: { id: data.skillTemplateId }
  });
  if (!skillTemplate) return;

  await indexSkillTemplateQueue.add({ skillTemplateId: skillTemplate.id });
});
