import { createQueue } from '@mtsrc/queue';
import { addAfterTransactionHook, db, env } from '@metorial-cargo/db';
import { getLifecycleJobId, getPropagationJobOpts, type LifecycleEvent } from './_ids';

let skillConfigurationLifecycleQueue = createQueue<{
  skillConfigurationId: string;
  event: LifecycleEvent;
}>({
  redisUrl: env.service.REDIS_URL,
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
  redisUrl: env.service.REDIS_URL,
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
        tenantOid: true,
        environmentOid: true
      }
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
              tenantOid: skillConfiguration.tenantOid,
              environmentOid: skillConfiguration.environmentOid,
              ...configurationFilter
            }
          },
          {
            skillMarketplace: {
              tenantOid: skillConfiguration.tenantOid,
              environmentOid: skillConfiguration.environmentOid,
              ...configurationFilter
            }
          },
          {
            skillMarketplace: {
              tenantOid: skillConfiguration.tenantOid,
              environmentOid: skillConfiguration.environmentOid,
              plugins: {
                some: configurationFilter
              }
            }
          },
          {
            skillMarketplace: {
              tenantOid: skillConfiguration.tenantOid,
              environmentOid: skillConfiguration.environmentOid,
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
              tenantOid: skillConfiguration.tenantOid,
              environmentOid: skillConfiguration.environmentOid,
              skillPluginSkills: {
                some: configurationFilter
              }
            }
          },
          {
            skillMarketplace: {
              tenantOid: skillConfiguration.tenantOid,
              environmentOid: skillConfiguration.environmentOid,
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
