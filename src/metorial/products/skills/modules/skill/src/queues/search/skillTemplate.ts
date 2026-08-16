import { voyager, voyagerIndex, voyagerSource } from '@metorial/skills-search';
import { db } from '@metorial/db';
import { createQueue, QueueRetryError } from '@metorial/queue';
import { getProjectTenantIdentifier } from '@metorial/skills-common';
import { skillResourceService } from '../../services/resource';

export let indexSkillTemplateQueue = createQueue<{ skillTemplateId: string }>({
  name: 'cargo/skill/search/skillTemplate',
  workerOpts: { concurrency: 10 }
});

export let indexSkillTemplateQueueProcessor = indexSkillTemplateQueue.process(async data => {
  let template = await db.skillTemplate.findUnique({
    where: { id: data.skillTemplateId },
    include: {
      instance: true
    }
  });
  if (!template) throw new QueueRetryError();

  if (
    template.status !== 'active' ||
    (!template.name && !template.description && !template.systemIdentifier)
  ) {
    await voyager.record.delete({
      sourceId: (await voyagerSource).id,
      indexId: voyagerIndex.skillTemplate.id,
      documentIds: [template.id]
    });
    return;
  }

  let resource = await skillResourceService.hydrateSkillTemplate(template);
  let integrations = resource.items
    .map(item => item.integration)
    .filter((item): item is NonNullable<typeof item> => !!item);
  let providers = resource.items
    .map(item => item.provider)
    .filter((item): item is NonNullable<typeof item> => !!item);
  await voyager.record.index({
    sourceId: (await voyagerSource).id,
    indexId: voyagerIndex.skillTemplate.id,
    documentId: template.id,
    tenantIds: template.projectOid
      ? [getProjectTenantIdentifier({ oid: template.projectOid })]
      : [],
    fields: {
      skillTemplateId: template.id,
      owner: template.owner,
      providerIds: providers.map(provider => provider.id),
      integrationIds: integrations.map(integration => integration.id)
    },
    body: {
      name: template.name,
      description: template.description,
      systemIdentifier: template.systemIdentifier,
      providerNames: providers.map(provider => provider.name),
      integrationNames: integrations.map(integration => integration.name)
    }
  });
});
