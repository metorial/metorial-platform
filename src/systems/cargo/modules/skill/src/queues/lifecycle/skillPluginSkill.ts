import { createQueue } from '@lowerdeck/queue';
import { addAfterTransactionHook, db, env } from '@metorial-cargo/db';
import { getLifecycleJobId, getPropagationJobOpts, type LifecycleEvent } from './_ids';

export let skillPluginSkillLifecycleQueue = createQueue<{
  skillPluginSkillId: string;
  event: LifecycleEvent;
}>({
  redisUrl: env.service.REDIS_URL,
  name: 'cargo/skill/lifecycle/pluginSkill',
  workerOpts: {
    concurrency: 10
  }
});

export let enqueueSkillPluginSkillLifecycle = async (d: {
  skillPluginSkillId: string;
  event: LifecycleEvent;
}) => {
  await addAfterTransactionHook(async () => {
    await skillPluginSkillLifecycleQueue.add(d, {
      id: getLifecycleJobId('pluginSkill', d.skillPluginSkillId)
    });
  });
};

export let skillPluginSkillLifecycleQueueProcessor = skillPluginSkillLifecycleQueue.process(
  async data => {
    await propagateSkillPluginSkillDirtyQueue.add(
      { skillPluginSkillId: data.skillPluginSkillId },
      getPropagationJobOpts('pluginSkill', data.skillPluginSkillId)
    );
  }
);

let propagateSkillPluginSkillDirtyQueue = createQueue<{
  skillPluginSkillId: string;
}>({
  redisUrl: env.service.REDIS_URL,
  name: 'cargo/skill/dirty/prop/pluginSkill',
  workerOpts: {
    concurrency: 10
  }
});

export let propagateSkillPluginSkillDirtyQueueProcessor =
  propagateSkillPluginSkillDirtyQueue.process(async data => {
    await db.skillDestination.updateMany({
      where: {
        OR: [
          {
            skillPlugin: {
              skillPluginSkills: {
                some: {
                  id: data.skillPluginSkillId
                }
              }
            }
          },
          {
            skillMarketplace: {
              plugins: {
                some: {
                  skillPlugin: {
                    skillPluginSkills: {
                      some: {
                        id: data.skillPluginSkillId
                      }
                    }
                  }
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
  });
