import { createQueue } from '@lowerdeck/queue';
import { addAfterTransactionHook, db, env } from '@metorial-cargo/db';
import { getLifecycleJobId, getPropagationJobOpts, type LifecycleEvent } from './_ids';

export let skillMarketplaceLifecycleQueue = createQueue<{
  skillMarketplaceId: string;
  event: LifecycleEvent;
}>({
  redisUrl: env.service.REDIS_URL,
  name: 'cargo/skill/lifecycle/marketplace',
  workerOpts: {
    concurrency: 10
  }
});

export let enqueueSkillMarketplaceLifecycle = async (d: {
  skillMarketplaceId: string;
  event: LifecycleEvent;
}) => {
  await addAfterTransactionHook(async () => {
    await skillMarketplaceLifecycleQueue.add(d, {
      id: getLifecycleJobId('marketplace', d.skillMarketplaceId)
    });
  });
};

export let skillMarketplaceLifecycleQueueProcessor = skillMarketplaceLifecycleQueue.process(
  async data => {
    await propagateSkillMarketplaceDirtyQueue.add(
      { skillMarketplaceId: data.skillMarketplaceId },
      getPropagationJobOpts('marketplace', data.skillMarketplaceId)
    );
  }
);

let propagateSkillMarketplaceDirtyQueue = createQueue<{
  skillMarketplaceId: string;
}>({
  redisUrl: env.service.REDIS_URL,
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
