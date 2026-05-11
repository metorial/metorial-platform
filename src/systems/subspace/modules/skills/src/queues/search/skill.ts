import { createQueue, QueueRetryError } from '@lowerdeck/queue';
import { db } from '@metorial-subspace/db';
import { voyager, voyagerIndex, voyagerSource } from '@metorial-subspace/module-search';
import { env } from '../../env';

export let indexSkillQueue = createQueue<{ skillId: string }>({
  name: 'sub/sk/sidx/skill',
  redisUrl: env.service.REDIS_URL
});

export let indexSkillRecord = async (d: { skillId: string }) => {
  let skill = await db.skill.findUnique({
    where: { id: d.skillId },
    include: {
      tenant: true,
      skillEntity: true,
      skillIntegrations: {
        where: { status: 'active' },
        include: {
          integration: true
        }
      },
      skillProviderLinks: {
        include: {
          provider: true
        }
      }
    }
  });
  if (!skill) throw new QueueRetryError();

  if (skill.status !== 'active' || (!skill.name && !skill.description)) {
    await voyager.record.delete({
      sourceId: (await voyagerSource).id,
      indexId: voyagerIndex.skill.id,
      documentIds: [skill.id]
    });
    return;
  }

  await voyager.record.index({
    sourceId: (await voyagerSource).id,
    indexId: voyagerIndex.skill.id,
    documentId: skill.id,
    tenantIds: [skill.tenant.id],
    fields: {
      skillId: skill.id,
      skillEntityId: skill.skillEntity.id,
      integrationIds: skill.skillIntegrations.map(item => item.integration.id),
      providerIds: skill.skillProviderLinks.map(link => link.provider.id)
    },
    body: {
      name: skill.name,
      description: skill.description,
      integrationNames: skill.skillIntegrations.map(item => item.integration.name),
      providerNames: skill.skillProviderLinks.map(link => link.provider.name)
    }
  });
};

export let indexSkillQueueProcessor = indexSkillQueue.process(async data => {
  await indexSkillRecord(data);
});
