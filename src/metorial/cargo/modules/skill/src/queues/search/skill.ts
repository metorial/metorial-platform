import { voyager, voyagerIndex, voyagerSource } from '@metorial/cargo-module-search';
import { db } from '@metorial/db';
import { createQueue, QueueRetryError } from '@metorial/queue';
import { skillResourceService } from '../../services/resource';

export let indexSkillQueue = createQueue<{ skillId: string }>({
  name: 'cargo/skill/search/skill',
  workerOpts: { concurrency: 10 }
});

export let indexSkillQueueProcessor = indexSkillQueue.process(async data => {
  let skill = await db.skill.findUnique({
    where: { id: data.skillId },
    include: {
      resourceTenant: true
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

  let resource = await skillResourceService.hydrateSkill(skill);
  await voyager.record.index({
    sourceId: (await voyagerSource).id,
    indexId: voyagerIndex.skill.id,
    documentId: skill.id,
    tenantIds: skill.resourceTenant ? [skill.resourceTenant.id] : [],
    fields: {
      skillId: skill.id,
      skillEntityId: skill.skillEntityId,
      integrationIds: resource.integrations.map(integration => integration.id),
      providerIds: resource.providers.map(provider => provider.id)
    },
    body: {
      name: skill.name,
      description: skill.description,
      clientName: skill.clientName,
      clientDescription: skill.clientDescription,
      integrationNames: resource.integrations.map(integration => integration.name),
      providerNames: resource.providers.map(provider => provider.name)
    }
  });
});
