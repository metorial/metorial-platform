import { createQueue, QueueRetryError } from '@lowerdeck/queue';
import { db } from '@metorial-subspace/db';
import { voyager, voyagerIndex, voyagerSource } from '@metorial-subspace/module-search';
import { env } from '../../env';

export let indexSkillTemplateQueue = createQueue<{ skillTemplateId: string }>({
  name: 'sub/sk/sidx/skillTemplate',
  redisUrl: env.service.REDIS_URL
});

export let indexSkillTemplateRecord = async (d: { skillTemplateId: string }) => {
  let skillTemplate = await db.skillTemplate.findUnique({
    where: { id: d.skillTemplateId },
    include: {
      tenant: true,
      skillTemplateItems: {
        include: {
          integration: true,
          provider: true
        }
      }
    }
  });
  if (!skillTemplate) throw new QueueRetryError();

  if (
    skillTemplate.status !== 'active' ||
    (!skillTemplate.name && !skillTemplate.description && !skillTemplate.systemIdentifier)
  ) {
    await voyager.record.delete({
      sourceId: (await voyagerSource).id,
      indexId: voyagerIndex.skillTemplate.id,
      documentIds: [skillTemplate.id]
    });
    return;
  }

  await voyager.record.index({
    sourceId: (await voyagerSource).id,
    indexId: voyagerIndex.skillTemplate.id,
    documentId: skillTemplate.id,
    tenantIds: skillTemplate.tenant ? [skillTemplate.tenant.id] : [],
    fields: {
      skillTemplateId: skillTemplate.id,
      owner: skillTemplate.owner,
      providerIds: skillTemplate.skillTemplateItems
        .map(item => item.provider?.id)
        .filter(Boolean),
      integrationIds: skillTemplate.skillTemplateItems
        .map(item => item.integration?.id)
        .filter(Boolean)
    },
    body: {
      name: skillTemplate.name,
      description: skillTemplate.description,
      systemIdentifier: skillTemplate.systemIdentifier,
      providerNames: skillTemplate.skillTemplateItems
        .map(item => item.provider?.name)
        .filter(Boolean),
      integrationNames: skillTemplate.skillTemplateItems
        .map(item => item.integration?.name)
        .filter(Boolean)
    }
  });
};

export let indexSkillTemplateQueueProcessor = indexSkillTemplateQueue.process(async data => {
  await indexSkillTemplateRecord(data);
});
