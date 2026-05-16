import { createQueue } from '@lowerdeck/queue';
import { addAfterTransactionHook, db, env } from '@metorial-cargo/db';
import { getLifecycleJobId, getPropagationJobOpts, type LifecycleEvent } from './_ids';

export let skillMarketplacePluginLifecycleQueue = createQueue<{
  skillMarketplacePluginId: string;
  event: LifecycleEvent;
}>({
  redisUrl: env.service.REDIS_URL,
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
    await propagateSkillMarketplacePluginDirtyQueue.add(
      { skillMarketplacePluginId: data.skillMarketplacePluginId },
      getPropagationJobOpts('marketplacePlugin', data.skillMarketplacePluginId)
    );
  });

let propagateSkillMarketplacePluginDirtyQueue = createQueue<{
  skillMarketplacePluginId: string;
}>({
  redisUrl: env.service.REDIS_URL,
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
