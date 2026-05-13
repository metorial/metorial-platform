import { createQueue, QueueRetryError } from '@lowerdeck/queue';
import { db } from '@metorial-subspace/db';
import { env } from '../../env';
import { indexSkillGroupQueue } from '../search/skillGroup';

export let skillGroupCreatedQueue = createQueue<{ skillGroupId: string }>({
  name: 'sub/sk/lc/skillGroup/created',
  redisUrl: env.service.REDIS_URL
});

export let skillGroupCreatedQueueProcessor = skillGroupCreatedQueue.process(async data => {
  let skillGroup = await db.skillGroup.findUnique({
    where: { id: data.skillGroupId }
  });
  if (!skillGroup) throw new QueueRetryError();

  await indexSkillGroupQueue.add({ skillGroupId: skillGroup.id });
});

export let skillGroupUpdatedQueue = createQueue<{ skillGroupId: string }>({
  name: 'sub/sk/lc/skillGroup/updated',
  redisUrl: env.service.REDIS_URL
});

export let skillGroupUpdatedQueueProcessor = skillGroupUpdatedQueue.process(async data => {
  let skillGroup = await db.skillGroup.findUnique({
    where: { id: data.skillGroupId }
  });
  if (!skillGroup) throw new QueueRetryError();

  await indexSkillGroupQueue.add({ skillGroupId: skillGroup.id });
});

export let skillGroupArchivedQueue = createQueue<{ skillGroupId: string }>({
  name: 'sub/sk/lc/skillGroup/archived',
  redisUrl: env.service.REDIS_URL
});

export let skillGroupArchivedQueueProcessor = skillGroupArchivedQueue.process(async data => {
  let skillGroup = await db.skillGroup.findUnique({
    where: { id: data.skillGroupId }
  });
  if (!skillGroup) return;

  await indexSkillGroupQueue.add({ skillGroupId: skillGroup.id });
});
