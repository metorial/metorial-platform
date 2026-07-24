import { addAfterTransactionHook, db, withTransaction } from '@metorial/db';
import { createQueue } from '@metorial/queue';
import { indexSkillMarketplaceQueue } from '../search/skillMarketplace';
import { indexSkillPluginQueue } from '../search/skillPlugin';
import { getLifecycleJobId, getPropagationJobOpts, type LifecycleEvent } from './_ids';

let skillMarketplaceLifecycleQueue = createQueue<{
  skillMarketplaceId: string;
  event: LifecycleEvent;
}>({
  name: 'cargo/skill/lifecycle/marketplace',
  workerOpts: {
    concurrency: 10
  }
});

export let enqueueSkillMarketplaceLifecycle = async (d: {
  skillMarketplaceId: string;
  event: LifecycleEvent;
}) => {
  await withTransaction(
    async db => {
      await db.skillDestination.updateMany({
        where: {
          skillMarketplace: { id: d.skillMarketplaceId }
        },
        data: {
          isDirty: true,
          lastTransientChangeAt: new Date()
        }
      });

      await addAfterTransactionHook(async () => {
        await skillMarketplaceLifecycleQueue.add(d, {
          id: getLifecycleJobId('marketplace', d.skillMarketplaceId)
        });
      });
    },
    { ifExists: true }
  );
};

export let skillMarketplaceLifecycleQueueProcessor = skillMarketplaceLifecycleQueue.process(
  async data => {
    await indexSkillMarketplaceQueue.add({
      skillMarketplaceId: data.skillMarketplaceId
    });

    let linkedPlugins = await db.skillMarketplacePlugin.findMany({
      where: {
        skillMarketplace: { id: data.skillMarketplaceId }
      },
      select: {
        skillPlugin: {
          select: { id: true }
        }
      }
    });
    for (let linkedPlugin of linkedPlugins) {
      await indexSkillPluginQueue.add({
        skillPluginId: linkedPlugin.skillPlugin.id
      });
    }

    await propagateSkillMarketplaceDirtyQueue.add(
      { skillMarketplaceId: data.skillMarketplaceId },
      getPropagationJobOpts('marketplace', data.skillMarketplaceId)
    );
  }
);

let propagateSkillMarketplaceDirtyQueue = createQueue<{
  skillMarketplaceId: string;
}>({
  name: 'cargo/skill/dirty/prop/marketplace',
  workerOpts: {
    concurrency: 10
  }
});

export let propagateSkillMarketplaceDirtyQueueProcessor =
  propagateSkillMarketplaceDirtyQueue.process(async data => {
    await db.skillDestination.updateMany({
      where: {
        skillMarketplace: { id: data.skillMarketplaceId }
      },
      data: {
        isDirty: true,
        lastTransientChangeAt: new Date()
      }
    });
  });
