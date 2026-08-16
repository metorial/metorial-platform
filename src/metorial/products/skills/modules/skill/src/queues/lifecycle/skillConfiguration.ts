import { addAfterTransactionHook, db } from '@metorial/db';
import { createQueue } from '@metorial/queue';
import { getLifecycleJobId, getPropagationJobOpts, type LifecycleEvent } from '@metorial/skills-common';

let skillConfigurationLifecycleQueue = createQueue<{
  skillConfigurationId: string;
  event: LifecycleEvent;
}>({
  name: 'cargo/skill/lifecycle/config',
  workerOpts: {
    concurrency: 10
  }
});

export let enqueueSkillConfigurationLifecycle = async (d: {
  skillConfigurationId: string;
  event: LifecycleEvent;
}) => {
  await addAfterTransactionHook(async () => {
    await skillConfigurationLifecycleQueue.add(d, {
      id: getLifecycleJobId('configuration', d.skillConfigurationId)
    });
  });
};

export let skillConfigurationLifecycleQueueProcessor =
  skillConfigurationLifecycleQueue.process(async data => {
    await propagateSkillConfigurationDirtyQueue.add(
      { skillConfigurationId: data.skillConfigurationId },
      getPropagationJobOpts('configuration', data.skillConfigurationId)
    );
  });

let propagateSkillConfigurationDirtyQueue = createQueue<{
  skillConfigurationId: string;
}>({
  name: 'cargo/skill/dirty/prop/config',
  workerOpts: {
    concurrency: 10
  }
});

export let propagateSkillConfigurationDirtyQueueProcessor =
  propagateSkillConfigurationDirtyQueue.process(async data => {
    let skillConfiguration = await db.skillConfiguration.findUnique({
      where: { id: data.skillConfigurationId }
    });
    if (!skillConfiguration) return;

    let configurationFilter = skillConfiguration.isDefault
      ? {
          OR: [
            { skillConfigurationOid: null as bigint | null },
            { skillConfiguration: { id: skillConfiguration.id } }
          ]
        }
      : { skillConfiguration: { id: skillConfiguration.id } };

    await db.skillDestination.updateMany({
      where: {
        OR: [
          {
            skillPlugin: {
              projectOid: skillConfiguration.projectOid,
              instanceOid: skillConfiguration.instanceOid,
              ...configurationFilter
            }
          },
          {
            skillMarketplace: {
              projectOid: skillConfiguration.projectOid,
              instanceOid: skillConfiguration.instanceOid,
              ...configurationFilter
            }
          },
          {
            skillMarketplace: {
              projectOid: skillConfiguration.projectOid,
              instanceOid: skillConfiguration.instanceOid,
              plugins: {
                some: configurationFilter
              }
            }
          },
          {
            skillMarketplace: {
              projectOid: skillConfiguration.projectOid,
              instanceOid: skillConfiguration.instanceOid,
              plugins: {
                some: {
                  skillPlugin: {
                    ...configurationFilter
                  }
                }
              }
            }
          },
          {
            skillPlugin: {
              projectOid: skillConfiguration.projectOid,
              instanceOid: skillConfiguration.instanceOid,
              skillPluginSkills: {
                some: configurationFilter
              }
            }
          },
          {
            skillMarketplace: {
              projectOid: skillConfiguration.projectOid,
              instanceOid: skillConfiguration.instanceOid,
              plugins: {
                some: {
                  skillPlugin: {
                    skillPluginSkills: {
                      some: configurationFilter
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
