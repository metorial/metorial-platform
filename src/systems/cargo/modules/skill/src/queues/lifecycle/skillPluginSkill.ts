import { createQueue } from '@mtsrc/queue';
import { addAfterTransactionHook, db, env } from '@metorial-cargo/db';
import { indexSkillPluginQueue } from '../search/skillPlugin';
import { getLifecycleJobId, getPropagationJobOpts, type LifecycleEvent } from './_ids';

let skillPluginSkillLifecycleQueue = createQueue<{
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
    let skillPluginSkill = await db.skillPluginSkill.findUnique({
      where: { id: data.skillPluginSkillId },
      include: {
        skillPlugin: {
          select: { id: true }
        }
      }
    });

    if (skillPluginSkill) {
      await indexSkillPluginQueue.add({
        skillPluginId: skillPluginSkill.skillPlugin.id
      });
    }

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
