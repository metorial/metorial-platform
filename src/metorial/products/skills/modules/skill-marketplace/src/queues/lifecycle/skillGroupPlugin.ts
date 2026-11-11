import { createCron } from '@metorial/cron';
import { addAfterTransactionHook, db } from '@metorial/db';
import { combineQueueProcessors, createQueue, dailyPacedDelay } from '@metorial/queue';
import { env } from '../../env';
import { skillGroupPluginService } from '../../services/skillGroupPlugin';

let pageSize = 500;
let reconcileStaleAfterMs = 1000 * 60 * 60 * 20;

// Sync jobs carry no dedup id: a job added while an equal one is already running must still run,
// or a membership change made during a reconcile would be lost until the backstop. Reconciles are
// idempotent and serialized per plugin, so duplicates only cost a no-op pass.
let skillGroupPluginGroupQueue = createQueue<{ skillGroupId: string; cursor?: string }>({
  name: 'cargo/skill/lifecycle/skillGroupPlugin/group',
  workerOpts: { concurrency: 10 }
});

export let enqueueSkillGroupPluginSync = async (d: { skillGroupIds: string[] }) => {
  if (!d.skillGroupIds.length) return;

  await addAfterTransactionHook(async () => {
    await skillGroupPluginGroupQueue.addMany(
      [...new Set(d.skillGroupIds)].map(skillGroupId => ({ skillGroupId }))
    );
  });
};

let skillGroupPluginGroupQueueProcessor = skillGroupPluginGroupQueue.process(async data => {
  let links = await db.skillGroupPlugin.findMany({
    where: {
      skillGroup: { id: data.skillGroupId },
      id: data.cursor ? { gt: data.cursor } : undefined
    },
    orderBy: { id: 'asc' },
    take: pageSize,
    select: { id: true }
  });
  if (!links.length) return;

  await skillGroupPluginSyncQueue.addMany(links.map(link => ({ skillGroupPluginId: link.id })));

  if (links.length === pageSize) {
    await skillGroupPluginGroupQueue.add({
      skillGroupId: data.skillGroupId,
      cursor: links[links.length - 1]!.id
    });
  }
});

let skillGroupPluginSyncQueue = createQueue<{ skillGroupPluginId: string }>({
  name: 'cargo/skill/lifecycle/skillGroupPlugin/plugin',
  workerOpts: { concurrency: 5, limiter: { max: 10, duration: 1000 } }
});

let skillGroupPluginSyncQueueProcessor = skillGroupPluginSyncQueue.process(async data => {
  await skillGroupPluginService.syncSkillGroupPlugin(data);
});

let skillGroupPluginBackstopCron = createCron(
  { name: 'cargo/skill/lifecycle/skillGroupPlugin/cron', cron: '0 3 * * *' },
  async () => {
    if (!env.skillSync.SKILL_SYNC_RECONCILER_CRONS_ENABLED) return;

    await skillGroupPluginBackstopManyQueue.add({});
  }
);

let skillGroupPluginBackstopManyQueue = createQueue<{ cursor?: string }>({
  name: 'cargo/skill/lifecycle/skillGroupPlugin/backstop/many',
  workerOpts: { concurrency: 1 }
});

let skillGroupPluginBackstopManyQueueProcessor = skillGroupPluginBackstopManyQueue.process(
  async data => {
    let links = await db.skillGroupPlugin.findMany({
      where: {
        id: data.cursor ? { gt: data.cursor } : undefined,
        skillPlugin: { status: 'active' },
        OR: [
          { lastReconciledAt: null },
          { lastReconciledAt: { lt: new Date(Date.now() - reconcileStaleAfterMs) } }
        ]
      },
      orderBy: { id: 'asc' },
      take: pageSize,
      select: { id: true }
    });
    if (!links.length) return;

    await skillGroupPluginSyncQueue.addMany(links.map(link => ({ skillGroupPluginId: link.id })));

    if (links.length === pageSize) {
      await skillGroupPluginBackstopManyQueue.add(
        { cursor: links[links.length - 1]!.id },
        dailyPacedDelay()
      );
    }
  }
);

export let skillGroupPluginQueueProcessor = combineQueueProcessors([
  skillGroupPluginGroupQueueProcessor,
  skillGroupPluginSyncQueueProcessor,
  skillGroupPluginBackstopCron,
  skillGroupPluginBackstopManyQueueProcessor
]);
