import { addAfterTransactionHook, db, withTransaction } from '@metorial/db';
import { createQueue } from '@metorial/queue';
import { indexSkillMarketplaceQueue } from '../search/skillMarketplace';
import { indexSkillPluginQueue } from '../search/skillPlugin';
import { getLifecycleJobId, getPropagationJobOpts, type LifecycleEvent } from '@metorial/skills-common';

let skillPluginLifecycleQueue = createQueue<{
  skillPluginId: string;
  event: LifecycleEvent;
}>({
  name: 'cargo/skill/lifecycle/plugin',
  workerOpts: {
    concurrency: 10
  }
});

export let enqueueSkillPluginLifecycle = async (d: {
  skillPluginId: string;
  event: LifecycleEvent;
}) => {
  await withTransaction(
    async db => {
      await db.skillDestination.updateMany({
        where: {
          skillPlugin: { id: d.skillPluginId }
        },
        data: {
          isDirty: true,
          lastTransientChangeAt: new Date()
        }
      });

      await addAfterTransactionHook(async () => {
        await skillPluginLifecycleQueue.add(d, {
          id: getLifecycleJobId('plugin', d.skillPluginId)
        });
      });
    },
    { ifExists: true }
  );
};

export let skillPluginLifecycleQueueProcessor = skillPluginLifecycleQueue.process(
  async data => {
    await indexSkillPluginQueue.add({ skillPluginId: data.skillPluginId });

    let linkedMarketplaces = await db.skillMarketplacePlugin.findMany({
      where: {
        skillPlugin: { id: data.skillPluginId }
      },
      select: {
        skillMarketplace: {
          select: { id: true }
        }
      }
    });
    for (let linkedMarketplace of linkedMarketplaces) {
      await indexSkillMarketplaceQueue.add({
        skillMarketplaceId: linkedMarketplace.skillMarketplace.id
      });
    }

    await propagateSkillPluginDirtyQueue.add(
      { skillPluginId: data.skillPluginId },
      getPropagationJobOpts('plugin', data.skillPluginId)
    );
  }
);

let propagateSkillPluginDirtyQueue = createQueue<{
  skillPluginId: string;
}>({
  name: 'cargo/skill/dirty/prop/plugin',
  workerOpts: {
    concurrency: 10
  }
});

export let propagateSkillPluginDirtyQueueProcessor = propagateSkillPluginDirtyQueue.process(
  async data => {
    await db.skillDestination.updateMany({
      where: {
        OR: [
          {
            skillPlugin: { id: data.skillPluginId }
          },
          {
            skillMarketplace: {
              plugins: {
                some: {
                  skillPlugin: { id: data.skillPluginId }
                }
              }
            }
          }
        ]
      },
      data: {
        isDirty: true,
        lastTransientChangeAt: new Date()
      }
    });
  }
);
