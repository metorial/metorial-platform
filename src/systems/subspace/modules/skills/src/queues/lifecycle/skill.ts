import { createQueue, QueueRetryError } from '@lowerdeck/queue';
import { db } from '@metorial-subspace/db';
import { cargo, ensureCargoScope } from '../../cargo';
import { env } from '../../env';
import { reconcileSkillProviderLinksQueue } from '../reconciler/reconcileSkillProviderLink';

export let syncSkillToCargoQueue = createQueue<{ skillId: string }>({
  name: 'sub/sk/lc/syncSkillToCargo',
  redisUrl: env.service.REDIS_URL
});

export let syncSkillToCargoQueueProcessor = syncSkillToCargoQueue.process(async data => {
  let skill = await db.skill.findUnique({
    where: { id: data.skillId },
    include: { environment: true, tenant: true }
  });
  if (!skill) throw new QueueRetryError();

  let cargoScope = await ensureCargoScope(skill);

  await cargo.skill.update({
    ...cargoScope,

    skillId: skill.id,

    name: skill.name,
    description: skill.description,
    metadata: skill.metadata as any,

    clientName: skill.clientName ?? skill.name,
    clientDescription: skill.clientDescription,
    clientMetadata: skill.clientMetadata as any,
    license: skill.license,
    compatibility: skill.compatibility
  });
});

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

  await syncSkillToCargoQueue.add({ skillId: skill.id });
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

  await syncSkillToCargoQueue.add({ skillId: skill.id });
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
