import { createQueue, QueueRetryError } from '@lowerdeck/queue';
import { db } from '@metorial-subspace/db';
import { env } from '../../env';
import { reconcileSkillProviderLinksQueue } from '../reconciler/reconcileSkillProviderLink';

export let skillCreatedQueue = createQueue<{ skillId: string }>({
  name: 'sub/sk/lc/skill/created',
  redisUrl: env.service.REDIS_URL
});

export let skillCreatedQueueProcessor = skillCreatedQueue.process(async data => {
  let skill = await db.skill.findUnique({
    where: { id: data.skillId }
  });
  if (!skill) throw new QueueRetryError();

  await reconcileSkillProviderLinksQueue.add({ skillId: skill.id });
});

export let skillUpdatedQueue = createQueue<{ skillId: string }>({
  name: 'sub/sk/lc/skill/updated',
  redisUrl: env.service.REDIS_URL
});

export let skillUpdatedQueueProcessor = skillUpdatedQueue.process(async data => {
  let skill = await db.skill.findUnique({
    where: { id: data.skillId }
  });
  if (!skill) throw new QueueRetryError();

  await reconcileSkillProviderLinksQueue.add({ skillId: skill.id });
});

export let skillArchivedQueue = createQueue<{ skillId: string }>({
  name: 'sub/sk/lc/skill/archived',
  redisUrl: env.service.REDIS_URL
});

export let skillArchivedQueueProcessor = skillArchivedQueue.process(async data => {
  let skill = await db.skill.findUnique({
    where: { id: data.skillId }
  });
  if (!skill) return;

  await reconcileSkillProviderLinksQueue.add({ skillId: skill.id });
});
