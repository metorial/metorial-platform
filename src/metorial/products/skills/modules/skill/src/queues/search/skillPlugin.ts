import { voyager, voyagerIndex, voyagerSource } from '@metorial/skills-search';
import { db } from '@metorial/db';
import { createQueue, QueueRetryError } from '@metorial/queue';
import { getProjectTenantIdentifier } from '../../internal/scope';

export let indexSkillPluginQueue = createQueue<{ skillPluginId: string }>({
  name: 'cargo/skill/search/plugin',
  workerOpts: {
    concurrency: 10
  }
});

export let indexSkillPluginQueueProcessor = indexSkillPluginQueue.process(async data => {
  let skillPlugin = await db.skillPlugin.findUnique({
    where: { id: data.skillPluginId },
    include: {
      skillPluginSkills: {
        where: { status: 'active' },
        include: {
          skill: true
        }
      },
      skillMarketplacePlugins: {
        where: { status: 'active' },
        include: {
          skillMarketplace: true
        }
      },
      project: true
    }
  });
  if (!skillPlugin) throw new QueueRetryError();

  if (skillPlugin.status !== 'active' || skillPlugin.isManaged) {
    await voyager.record.delete({
      sourceId: (await voyagerSource).id,
      indexId: voyagerIndex.skillPlugin.id,
      documentIds: [skillPlugin.id]
    });
    return;
  }

  await voyager.record.index({
    sourceId: (await voyagerSource).id,
    indexId: voyagerIndex.skillPlugin.id,
    documentId: skillPlugin.id,
    tenantIds: [getProjectTenantIdentifier(skillPlugin.project)],
    fields: {
      skillPluginId: skillPlugin.id,
      skillIds: skillPlugin.skillPluginSkills.map(item => item.skill.id),
      skillMarketplaceIds: skillPlugin.skillMarketplacePlugins.map(
        item => item.skillMarketplace.id
      )
    },
    body: {
      name: skillPlugin.name,
      slug: skillPlugin.slug,
      description: skillPlugin.description,
      longDescription: skillPlugin.longDescription,
      category: skillPlugin.category,
      skillNames: skillPlugin.skillPluginSkills.map(item => item.skill.name),
      skillDescriptions: skillPlugin.skillPluginSkills.map(item => item.skill.description),
      skillClientNames: skillPlugin.skillPluginSkills.map(item => item.skill.clientName),
      skillClientDescriptions: skillPlugin.skillPluginSkills.map(
        item => item.skill.clientDescription
      ),
      marketplaceNames: skillPlugin.skillMarketplacePlugins.map(
        item => item.skillMarketplace.name
      ),
      marketplaceSlugs: skillPlugin.skillMarketplacePlugins.map(
        item => item.skillMarketplace.slug
      ),
      marketplaceDescriptions: skillPlugin.skillMarketplacePlugins.map(
        item => item.skillMarketplace.description
      )
    }
  });
});
