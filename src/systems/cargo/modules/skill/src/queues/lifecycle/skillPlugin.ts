import { createQueue } from '@lowerdeck/queue';
import { addAfterTransactionHook, db, env } from '@metorial-cargo/db';
import { getLifecycleJobId, getPropagationJobOpts, type LifecycleEvent } from './_ids';

export let skillPluginLifecycleQueue = createQueue<{
  skillPluginId: string;
  event: LifecycleEvent;
}>({
  redisUrl: env.service.REDIS_URL,
  name: 'cargo/skill/lifecycle/plugin',
  workerOpts: {
    concurrency: 10
  }
});

export let enqueueSkillPluginLifecycle = async (d: {
  skillPluginId: string;
  event: LifecycleEvent;
}) => {
  await addAfterTransactionHook(async () => {
    await skillPluginLifecycleQueue.add(d, {
      id: getLifecycleJobId('plugin', d.skillPluginId)
    });
  });
};

export let skillPluginLifecycleQueueProcessor = skillPluginLifecycleQueue.process(
  async data => {
    await propagateSkillPluginDirtyQueue.add(
      { skillPluginId: data.skillPluginId },
      getPropagationJobOpts('plugin', data.skillPluginId)
    );
  }
);

let propagateSkillPluginDirtyQueue = createQueue<{
  skillPluginId: string;
}>({
  redisUrl: env.service.REDIS_URL,
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
