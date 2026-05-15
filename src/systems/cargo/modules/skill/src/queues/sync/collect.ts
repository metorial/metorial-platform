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
  let exp = await db.skillDestinationSync.findUnique({
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
  if (!exp || exp.status !== 'processing') return;

  let currentItems = await db.skillDestinationItem.findMany({
    where: { destinationOid: exp.destination.oid },
    include: { skill: true, skillPlugin: true, skillMarketplace: true }
  });

  let taskManager = createTaskManager(currentItems);

  if (exp.destination.skillMarketplace) {
    let marketplace = await db.skillMarketplace.findFirstOrThrow({
      where: { oid: exp.destination.skillMarketplace.oid },
      include: {
        plugins: {
          include: {
            skillPlugin: {
              include: {
                skillPluginSkills: {
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
  } else if (exp.destination.skillPlugin) {
    let plugin = await db.skillPlugin.findFirstOrThrow({
      where: { oid: exp.destination.skillPlugin.oid },
      include: {
        skillPluginSkills: {
          include: {
            skill: true
          }
        }
      }
    });

    taskManager.addOrUpdateItem({ skillPlugin: plugin });

    for (let skillPluginSkill of plugin.skillPluginSkills) {
      taskManager.addOrUpdateItem({
        skill: skillPluginSkill.skill,
        skillPlugin: plugin
      });
    }
  }

  let tasks = taskManager.getTasks();

  await syncProcessQueue.add({
    skillDestinationSyncId: data.skillDestinationSyncId,
    tasks
  });
});
