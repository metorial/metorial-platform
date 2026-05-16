import { createQueue } from '@lowerdeck/queue';
import { db, env } from '@metorial-cargo/db';
import { createTaskManager } from './_lib/task';
import { syncProcessQueue } from './process';

export let syncCollectQueue = createQueue<{
  skillDestinationSyncId: string;
}>({
  redisUrl: env.service.REDIS_URL,
  name: 'cargo/skill/sync/collect',
  workerOpts: {
    concurrency: 10
  }
});

export let syncCollectQueueProcessor = syncCollectQueue.process(async data => {
  let sync = await db.skillDestinationSync.findUnique({
    where: { id: data.skillDestinationSyncId },
    include: {
      destination: {
        include: {
          skillMarketplace: true,
          skillPlugin: true
        }
      }
    }
  });
  if (!sync || sync.status !== 'processing') return;

  let currentItems = await db.skillDestinationItem.findMany({
    where: { destinationOid: sync.destination.oid },
    include: { skill: true, skillPlugin: true, skillMarketplace: true }
  });

  let taskManager = createTaskManager(currentItems);

  if (sync.destination.skillMarketplace) {
    let marketplace = await db.skillMarketplace.findFirst({
      where: { oid: sync.destination.skillMarketplace.oid, status: 'active' },
      include: {
        plugins: {
          where: {
            status: 'active',
            skillPlugin: {
              status: 'active'
            }
          },
          include: {
            skillPlugin: {
              include: {
                skillPluginSkills: {
                  where: {
                    status: 'active',
                    skill: {
                      status: 'active'
                    }
                  },
                  include: {
                    skill: true
                  }
                }
              }
            }
          }
        }
      }
    });

    if (marketplace) {
      taskManager.addOrUpdateItem({ skillMarketplace: marketplace });

      for (let plugin of marketplace.plugins) {
        taskManager.addOrUpdateItem({ skillPlugin: plugin.skillPlugin });

        for (let skillPluginSkill of plugin.skillPlugin.skillPluginSkills) {
          taskManager.addOrUpdateItem({
            skill: skillPluginSkill.skill,
            skillPlugin: plugin.skillPlugin
          });
        }
      }
    } else {
      let currentMarketplaceItem = currentItems.find(
        item => item.skillMarketplace?.id === sync.destination.skillMarketplace?.id
      );

      if (currentMarketplaceItem?.skillMarketplace) {
        taskManager.deleteItem({ skillMarketplace: currentMarketplaceItem.skillMarketplace });
      }
    }
  } else if (sync.destination.skillPlugin) {
    let plugin = await db.skillPlugin.findFirst({
      where: { oid: sync.destination.skillPlugin.oid, status: 'active' },
      include: {
        skillPluginSkills: {
          where: {
            status: 'active',
            skill: {
              status: 'active'
            }
          },
          include: {
            skill: true
          }
        }
      }
    });

    if (plugin) {
      taskManager.addOrUpdateItem({ skillPlugin: plugin });

      for (let skillPluginSkill of plugin.skillPluginSkills) {
        taskManager.addOrUpdateItem({
          skill: skillPluginSkill.skill,
          skillPlugin: plugin
        });
      }
    }
  }

  let tasks = taskManager.getTasks();

  await syncProcessQueue.add({
    skillDestinationSyncId: data.skillDestinationSyncId,
    tasks
  });
});
