import { addAfterTransactionHook, db } from '@metorial/db';
import { createQueue } from '@metorial/queue';
import { indexSkillMarketplaceQueue } from '../search/skillMarketplace';
import { indexSkillPluginQueue } from '../search/skillPlugin';
import { getLifecycleJobId, getPropagationJobOpts, type LifecycleEvent } from './_ids';

let skillMarketplacePluginLifecycleQueue = createQueue<{
  skillMarketplacePluginId: string;
  event: LifecycleEvent;
}>({
  name: 'cargo/skill/lifecycle/marketplacePlugin',
  workerOpts: {
    concurrency: 10
  }
});

export let enqueueSkillMarketplacePluginLifecycle = async (d: {
  skillMarketplacePluginId: string;
  event: LifecycleEvent;
}) => {
  await addAfterTransactionHook(async () => {
    await skillMarketplacePluginLifecycleQueue.add(d, {
      id: getLifecycleJobId('marketplacePlugin', d.skillMarketplacePluginId)
    });
  });
};

export let skillMarketplacePluginLifecycleQueueProcessor =
  skillMarketplacePluginLifecycleQueue.process(async data => {
    let skillMarketplacePlugin = await db.skillMarketplacePlugin.findUnique({
      where: { id: data.skillMarketplacePluginId },
      include: {
        skillMarketplace: {
          select: { id: true }
        },
        skillPlugin: {
          select: { id: true }
        }
      }
    });

    if (skillMarketplacePlugin) {
      await indexSkillMarketplaceQueue.add({
        skillMarketplaceId: skillMarketplacePlugin.skillMarketplace.id
      });
      await indexSkillPluginQueue.add({
        skillPluginId: skillMarketplacePlugin.skillPlugin.id
      });
    }

    await propagateSkillMarketplacePluginDirtyQueue.add(
      { skillMarketplacePluginId: data.skillMarketplacePluginId },
      getPropagationJobOpts('marketplacePlugin', data.skillMarketplacePluginId)
    );
  });

let propagateSkillMarketplacePluginDirtyQueue = createQueue<{
  skillMarketplacePluginId: string;
}>({
  name: 'cargo/skill/dirty/prop/marketplacePlugin',
  workerOpts: {
    concurrency: 10
  }
});

export let propagateSkillMarketplacePluginDirtyQueueProcessor =
  propagateSkillMarketplacePluginDirtyQueue.process(async data => {
    await db.skillDestination.updateMany({
      where: {
        skillMarketplace: {
          plugins: {
            some: {
              id: data.skillMarketplacePluginId
            }
          }
        }
      },
      data: {
        isDirty: true,
        lastTransientChangeAt: new Date()
      }
    });
  });
