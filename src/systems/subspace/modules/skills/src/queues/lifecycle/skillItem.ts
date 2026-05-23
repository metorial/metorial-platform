import { createQueue, QueueRetryError } from '@mtsrc/queue';
import { db } from '@metorial-subspace/db';
import { env } from '../../env';
import { reconcileSkillProviderLinksQueue } from '../reconciler/reconcileSkillProviderLink';

export let skillItemCreatedQueue = createQueue<{ skillItemId: string }>({
  name: 'sub/sk/lc/skillItem/created',
  redisUrl: env.service.REDIS_URL
});

export let skillItemCreatedQueueProcessor = skillItemCreatedQueue.process(async data => {
  let skillItem = await db.skillItem.findUnique({
    where: { id: data.skillItemId },
    include: { skill: true }
  });
  if (!skillItem) throw new QueueRetryError();

  await reconcileSkillProviderLinksQueue.add({ skillId: skillItem.skill.id });
});

export let skillItemArchivedQueue = createQueue<{ skillItemId: string }>({
  name: 'sub/sk/lc/skillItem/archived',
  redisUrl: env.service.REDIS_URL
});

export let skillItemArchivedQueueProcessor = skillItemArchivedQueue.process(async data => {
  let skillItem = await db.skillItem.findUnique({
    where: { id: data.skillItemId },
    include: { skill: true }
  });
  if (!skillItem) return;

  await reconcileSkillProviderLinksQueue.add({ skillId: skillItem.skill.id });
});
