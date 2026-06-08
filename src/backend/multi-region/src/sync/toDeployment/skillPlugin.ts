import { db } from '@metorial/db';
import { createQueue } from '@metorial/queue';
import { cell } from '../../cell';
import { SkillPlugin } from '../../db';

export let syncSkillPluginToDeploymentQueue = createQueue<{
  skillPlugin: SkillPlugin;
}>({
  name: 'global/sync/to-deployment/skill-plugin'
});

export let syncSkillPluginToDeploymentQueueProcessor =
  syncSkillPluginToDeploymentQueue.process(async data => {
    let skillPlugin = data.skillPlugin;

    await db.cellSkillPlugin.upsert({
      where: { id: skillPlugin.id },
      update: {
        status: skillPlugin.status,
        name: skillPlugin.name,
        slug: skillPlugin.slug,
        isOwnedByDeployment: skillPlugin.ownerOid === (await cell).oid,
        createdAt: skillPlugin.createdAt,
        updatedAt: skillPlugin.updatedAt
      },
      create: {
        id: skillPlugin.id,
        status: skillPlugin.status,
        name: skillPlugin.name,
        slug: skillPlugin.slug,
        isOwnedByDeployment: skillPlugin.ownerOid === (await cell).oid,
        createdAt: skillPlugin.createdAt,
        updatedAt: skillPlugin.updatedAt
      }
    });
  });
