import { createCron } from '@metorial/cron';
import { db } from '@metorial/db';
import { consumerAccessService } from '../services/consumerAccess';

export let cleanupOrphanedSkillPluginAccessCron = createCron(
  {
    name: 'cons/skillPluginAccess/cleanup',
    cron: '* * * * *'
  },
  async () => {
    let pluginAccesses = await db.consumerAccess.findMany({
      where: {
        type: 'skill_plugin',
        skillPluginOid: {
          not: null
        }
      },
      distinct: ['skillPluginOid'],
      take: 100,
      select: {
        skillPluginOid: true,
        skillPlugin: {
          select: {
            oid: true,
            organizationOid: true
          }
        }
      }
    });

    for (let access of pluginAccesses) {
      if (!access.skillPlugin) continue;

      await consumerAccessService.reconcileSkillPluginConsumerAccess({
        skillPlugin: access.skillPlugin
      });
    }
  }
);
