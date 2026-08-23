import { addAfterTransactionHook, db } from '@metorial/db';
import { Fabric } from '@metorial/fabric';
import { enqueueManagedSkillPluginLifecycle } from '@metorial/module-skill-marketplace';
import { createQueue } from '@metorial/queue';
import { getLifecycleJobId, getPropagationJobOpts, type LifecycleEvent } from '@metorial/skills-common';
import { indexSkillGroupQueue } from '@metorial/module-skill-groups';
import { indexSkillQueue } from '../search/skill';

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
  let skill = await db.skill.findUnique({
    where: { id: data.skillId },
    include: {
      instance: true,
      skillGroupItems: {
        where: { status: 'active' },
        select: { skillGroup: { select: { id: true } } }
      }
    }
  });
  if (skill?.instance) {
    await Fabric.fire(
      data.event === 'created'
        ? 'skill.created:after'
        : data.event === 'updated'
          ? 'skill.updated:after'
          : 'skill.archived:after',
      { instance: skill.instance, skill }
    );
  }
  await enqueueManagedSkillPluginLifecycle(data);
  await propagateSkillDirtyQueue.add(
    { skillId: data.skillId },
    getPropagationJobOpts('skill', data.skillId)
  );
  await Promise.all([
    indexSkillQueue.add({ skillId: data.skillId }),
    indexSkillGroupQueue.addMany(
      (skill?.skillGroupItems ?? []).map(item => ({
        skillGroupId: item.skillGroup.id
      }))
    )
  ]);
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
