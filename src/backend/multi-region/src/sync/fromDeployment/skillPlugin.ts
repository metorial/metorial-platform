import { createCron } from '@metorial/cron';
import { addAfterTransactionHook, db } from '@metorial/db';
import { Fabric } from '@metorial/fabric';
import { createQueue } from '@metorial/queue';
import { cell } from '../../cell';
import { globalDB } from '../../db';
import { upsertOrganization } from './organization';

export let syncSkillPluginsCron = createCron(
  {
    name: 'global/sync/from-deployment/skill-plugin',
    cron: process.env.NODE_ENV == 'production' ? '0 * * * *' : '* * * * *'
  },
  async () => {
    await syncSkillPluginsManyQueue.add({});
  }
);

let syncSkillPluginsManyQueue = createQueue<{ cursor?: string }>({
  name: 'global/sync/from-deployment/skill-plugin-many'
});

export let syncSkillPluginsManyQueueProcessor = syncSkillPluginsManyQueue.process(
  async data => {
    let skillPlugins = await db.skillPlugin.findMany({
      where: {
        id: { gt: data.cursor }
      },
      orderBy: { id: 'asc' },
      take: 100,
      select: { id: true }
    });
    if (skillPlugins.length == 0) return;

    await syncSkillPluginSingleQueue.addMany(
      skillPlugins.map(skillPlugin => ({ skillPluginId: skillPlugin.id }))
    );

    await syncSkillPluginsManyQueue.add({
      cursor: skillPlugins[skillPlugins.length - 1].id
    });
  }
);

let syncSkillPluginSingleQueue = createQueue<{ skillPluginId: string }>({
  name: 'global/sync/from-deployment/skill-plugin-single'
});

export let syncSkillPluginSingleQueueProcessor = syncSkillPluginSingleQueue.process(
  async data => {
    let skillPlugin = await db.skillPlugin.findUnique({
      where: { id: data.skillPluginId },
      include: {
        organization: {
          select: {
            id: true
          }
        },
        instance: {
          select: {
            id: true
          }
        }
      }
    });
    if (!skillPlugin) return;

    await upsertOrganization(skillPlugin.organization.id);

    let inner = {
      status: skillPlugin.status,
      name: skillPlugin.name,
      slug: skillPlugin.slug,
      organizationId: skillPlugin.organization.id,
      instanceId: skillPlugin.instance.id,
      createdAt: skillPlugin.createdAt,
      ownerOid: (await cell).oid
    };

    await globalDB.skillPlugin.upsert({
      where: { id: skillPlugin.id },
      update: inner,
      create: {
        id: skillPlugin.id,
        ...inner
      }
    });
  }
);

let enqueueSkillPluginSync = async (skillPluginId: string) => {
  await addAfterTransactionHook(() => syncSkillPluginSingleQueue.add({ skillPluginId }));
};

Fabric.listen('skill.plugin.created:after', async event => {
  await enqueueSkillPluginSync(event.skillPlugin.id);
});

Fabric.listen('skill.plugin.updated:after', async event => {
  await enqueueSkillPluginSync(event.skillPlugin.id);
});

Fabric.listen('skill.plugin.archived:after', async event => {
  await enqueueSkillPluginSync(event.skillPlugin.id);
});

Fabric.listen('skill.plugin.deleted:after', async event => {
  await enqueueSkillPluginSync(event.skillPlugin.id);
});
