import { addAfterTransactionHook, db } from '@metorial/db';
import { createQueue } from '@metorial/queue';
import { requireRecordScope } from '../../internal/scope';
import { getLifecycleJobId, getPropagationJobOpts, type LifecycleEvent } from './_ids';

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
      where: { id: data.skillConfigurationId },
      select: {
        id: true,
        isDefault: true,
        projectOid: true,
        instanceOid: true
      }
    });
    if (!skillConfiguration) return;

    let scope = requireRecordScope('Skill configuration', skillConfiguration);

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
              projectOid: scope.project.oid,
              instanceOid: scope.instance.oid,
              ...configurationFilter
            }
          },
          {
            skillMarketplace: {
              projectOid: scope.project.oid,
              instanceOid: scope.instance.oid,
              ...configurationFilter
            }
          },
          {
            skillMarketplace: {
              projectOid: scope.project.oid,
              instanceOid: scope.instance.oid,
              plugins: {
                some: configurationFilter
              }
            }
          },
          {
            skillMarketplace: {
              projectOid: scope.project.oid,
              instanceOid: scope.instance.oid,
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
              projectOid: scope.project.oid,
              instanceOid: scope.instance.oid,
              skillPluginSkills: {
                some: configurationFilter
              }
            }
          },
          {
            skillMarketplace: {
              projectOid: scope.project.oid,
              instanceOid: scope.instance.oid,
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
