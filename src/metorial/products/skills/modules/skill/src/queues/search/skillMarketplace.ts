import { voyager, voyagerIndex, voyagerSource } from '@metorial/skills-search';
import { db } from '@metorial/db';
import { createQueue, QueueRetryError } from '@metorial/queue';
import { getProjectTenantIdentifier } from '../../internal/scope';

export let indexSkillMarketplaceQueue = createQueue<{ skillMarketplaceId: string }>({
  name: 'cargo/skill/search/marketplace',
  workerOpts: {
    concurrency: 10
  }
});

export let indexSkillMarketplaceQueueProcessor = indexSkillMarketplaceQueue.process(
  async data => {
    let skillMarketplace = await db.skillMarketplace.findUnique({
      where: { id: data.skillMarketplaceId },
      include: {
        plugins: {
          where: {
            status: 'active',
            skillPlugin: {
              status: 'active',
              isManaged: false
            }
          },
          include: {
            skillPlugin: {
              select: {
                id: true,
                name: true,
                slug: true,
                description: true,
                longDescription: true,
                category: true
              }
            }
          }
        },
        project: true
      }
    });
    if (!skillMarketplace) throw new QueueRetryError();

    if (skillMarketplace.status !== 'active') {
      await voyager.record.delete({
        sourceId: (await voyagerSource).id,
        indexId: voyagerIndex.skillMarketplace.id,
        documentIds: [skillMarketplace.id]
      });
      return;
    }

    await voyager.record.index({
      sourceId: (await voyagerSource).id,
      indexId: voyagerIndex.skillMarketplace.id,
      documentId: skillMarketplace.id,
      tenantIds: [getProjectTenantIdentifier(skillMarketplace.project)],
      fields: {
        skillMarketplaceId: skillMarketplace.id,
        skillPluginIds: skillMarketplace.plugins.map(item => item.skillPlugin.id)
      },
      body: {
        name: skillMarketplace.name,
        slug: skillMarketplace.slug,
        description: skillMarketplace.description,
        pluginNames: skillMarketplace.plugins.map(item => item.skillPlugin.name),
        pluginSlugs: skillMarketplace.plugins.map(item => item.skillPlugin.slug),
        pluginDescriptions: skillMarketplace.plugins.map(item => item.skillPlugin.description),
        pluginLongDescriptions: skillMarketplace.plugins.map(
          item => item.skillPlugin.longDescription
        ),
        pluginCategories: skillMarketplace.plugins.map(item => item.skillPlugin.category)
      }
    });
  }
);
