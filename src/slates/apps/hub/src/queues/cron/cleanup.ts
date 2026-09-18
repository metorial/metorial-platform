import { createCron } from '@lowerdeck/cron';
import {
  combineQueueProcessors,
  createQueue,
  deleteInChunks,
  hourlyPacedDelay
} from '@lowerdeck/queue';
import { subDays } from 'date-fns';
import { db } from '../../db';
import { env } from '../../env';

export let SLATE_DISCOVERY_RETENTION_DAYS = 5;
export let TRIGGER_ROUTING_DROP_RETENTION_DAYS = 30;
export let TRIGGER_ROUTING_MATCHER_EVALUATION_RETENTION_DAYS = 5;

let matcherEvaluationCleanupBatchSize = 500;

export let cleanupExpiredTriggerRoutingDrops = async () => {
  let cutoff = subDays(new Date(), TRIGGER_ROUTING_DROP_RETENTION_DAYS);

  return deleteInChunks({
    chunkSize: matcherEvaluationCleanupBatchSize,
    selectKeys: async chunkSize => {
      let rows = await db.triggerRoutingDrop.findMany({
        where: { bucketStart: { lt: cutoff } },
        orderBy: { bucketStart: 'asc' },
        take: chunkSize,
        select: { oid: true }
      });
      return rows.map(row => row.oid);
    },
    deleteKeys: oids => db.triggerRoutingDrop.deleteMany({ where: { oid: { in: oids } } })
  });
};

export let cleanupExpiredTriggerRoutingMatcherEvaluations = async () => {
  let cutoff = subDays(new Date(), TRIGGER_ROUTING_MATCHER_EVALUATION_RETENTION_DAYS);

  return deleteInChunks({
    chunkSize: matcherEvaluationCleanupBatchSize,
    selectKeys: async chunkSize => {
      let rows = await db.triggerRoutingMatcherEvaluation.findMany({
        where: { createdAt: { lt: cutoff } },
        orderBy: { createdAt: 'asc' },
        take: chunkSize,
        select: { oid: true }
      });
      return rows.map(row => row.oid);
    },
    deleteKeys: oids =>
      db.triggerRoutingMatcherEvaluation.deleteMany({ where: { oid: { in: oids } } })
  });
};

export let cleanupExpiredSlateVersionDiscoveries = async () => {
  let cutoff = subDays(new Date(), SLATE_DISCOVERY_RETENTION_DAYS);

  return deleteInChunks({
    chunkSize: matcherEvaluationCleanupBatchSize,
    selectKeys: async chunkSize => {
      let rows = await db.slateVersionDiscovery.findMany({
        where: { createdAt: { lt: cutoff } },
        orderBy: { createdAt: 'asc' },
        take: chunkSize,
        select: { oid: true }
      });
      return rows.map(row => row.oid);
    },
    deleteKeys: oids => db.slateVersionDiscovery.deleteMany({ where: { oid: { in: oids } } })
  });
};

let cleanupExpiredManualDecrypts = async () =>
  deleteInChunks({
    chunkSize: matcherEvaluationCleanupBatchSize,
    selectKeys: async chunkSize => {
      let rows = await db.slateAuthConfigManualDecrypt.findMany({
        where: { createdAt: { lt: subDays(new Date(), 3) } },
        orderBy: { createdAt: 'asc' },
        take: chunkSize,
        select: { oid: true }
      });
      return rows.map(row => row.oid);
    },
    deleteKeys: oids =>
      db.slateAuthConfigManualDecrypt.deleteMany({ where: { oid: { in: oids } } })
  });

let phases = {
  manualDecrypt: cleanupExpiredManualDecrypts,
  slateVersionDiscovery: cleanupExpiredSlateVersionDiscoveries,
  triggerRoutingDrop: cleanupExpiredTriggerRoutingDrops,
  triggerRoutingMatcherEvaluation: cleanupExpiredTriggerRoutingMatcherEvaluations
};

type CleanupPhase = keyof typeof phases;

let cleanupQueue = createQueue<{ phase: CleanupPhase }>({
  name: 'shub/cleanup/phase',
  redisUrl: env.service.REDIS_URL,
  workerOpts: { concurrency: 1, limiter: { max: 5, duration: 1000 } }
});

let cleanupQueueProcessor = cleanupQueue.process(async data => {
  let phase = phases[data.phase];
  if (!phase) return;

  let { hasMore } = await phase();
  if (hasMore) await cleanupQueue.add({ phase: data.phase }, hourlyPacedDelay());
});

export let cleanupCron = createCron(
  {
    name: 'shub/cleanup/cron',
    cron: '0 * * * *',
    redisUrl: env.service.REDIS_URL
  },
  async () => {
    await cleanupQueue.addManyWithOps(
      (Object.keys(phases) as CleanupPhase[]).map((phase, index) => ({
        data: { phase },
        opts: { id: phase, delay: index * 5_000 }
      }))
    );
  }
);

export let cleanupProcessors = combineQueueProcessors([cleanupCron, cleanupQueueProcessor]);
