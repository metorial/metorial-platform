import { addAfterTransactionHook, db } from '@metorial/db';
import { createQueue } from '@metorial/queue';
import { getLifecycleJobId, getPropagationJobOpts, type LifecycleEvent } from './_ids';
import { enqueueManagedSkillPluginLifecycle } from './managedSkillPlugin';

let skillLifecycleQueue = createQueue<{
  skillId: string;
  event: LifecycleEvent;
}>({
  name: 'cargo/skill/lifecycle/skill',
  workerOpts: {
    concurrency: 10
  }
});

export let enqueueSkillLifecycle = async (d: { skillId: string; event: LifecycleEvent }) => {
  await addAfterTransactionHook(async () => {
    await skillLifecycleQueue.add(d, {
      id: getLifecycleJobId('skill', d.skillId)
    });
  });
};

export let skillLifecycleQueueProcessor = skillLifecycleQueue.process(async data => {
  await enqueueManagedSkillPluginLifecycle(data);
  await propagateSkillDirtyQueue.add(
    { skillId: data.skillId },
    getPropagationJobOpts('skill', data.skillId)
  );
});

export let propagateSkillDirtyQueue = createQueue<{
  skillId: string;
}>({
  name: 'cargo/skill/dirty/prop/skill',
  workerOpts: {
    concurrency: 10
  }
});

export let propagateSkillDirtyQueueProcessor = propagateSkillDirtyQueue.process(async data => {
  await db.skillDestination.updateMany({
    where: {
      OR: [
        {
          skillPlugin: {
            skillPluginSkills: {
              some: {
                skill: { id: data.skillId }
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
                      skill: { id: data.skillId }
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
