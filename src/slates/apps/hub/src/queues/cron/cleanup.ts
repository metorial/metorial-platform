import { createCron } from '@lowerdeck/cron';
import { subDays } from 'date-fns';
import { db } from '../../db';
import { env } from '../../env';

export let SLATE_DISCOVERY_RETENTION_DAYS = 5;
export let TRIGGER_ROUTING_DROP_RETENTION_DAYS = 30;
export let TRIGGER_ROUTING_MATCHER_EVALUATION_RETENTION_DAYS = 5;

let matcherEvaluationCleanupBatchSize = 500;

export let cleanupExpiredTriggerRoutingDrops = async () => {
  await db.triggerRoutingDrop.deleteMany({
    where: { bucketStart: { lt: subDays(new Date(), TRIGGER_ROUTING_DROP_RETENTION_DAYS) } }
  });
};

export let cleanupExpiredTriggerRoutingMatcherEvaluations = async () => {
  let cutoff = subDays(new Date(), TRIGGER_ROUTING_MATCHER_EVALUATION_RETENTION_DAYS);

  while (true) {
    let records = await db.triggerRoutingMatcherEvaluation.findMany({
      where: { createdAt: { lt: cutoff } },
      orderBy: { createdAt: 'asc' },
      take: matcherEvaluationCleanupBatchSize,
      select: { oid: true }
    });
    if (records.length === 0) return;

    await db.triggerRoutingMatcherEvaluation.deleteMany({
      where: { oid: { in: records.map(record => record.oid) } }
    });
  }
};

export let cleanupExpiredSlateVersionDiscoveries = async () => {
  let fiveDaysAgo = subDays(new Date(), SLATE_DISCOVERY_RETENTION_DAYS);

  await db.slateVersionDiscovery.deleteMany({
    where: {
      createdAt: { lt: fiveDaysAgo }
    }
  });
};

export let cleanupCron = createCron(
  {
    name: 'shub/cleanup/cron',
    cron: '0 * * * *',
    redisUrl: env.service.REDIS_URL
  },
  async () => {
    let threeDaysAga = subDays(new Date(), 3);

    await db.slateAuthConfigManualDecrypt.deleteMany({
      where: {
        createdAt: { lt: threeDaysAga }
      }
    });

    await cleanupExpiredSlateVersionDiscoveries();
    await cleanupExpiredTriggerRoutingDrops();
    await cleanupExpiredTriggerRoutingMatcherEvaluations();
  }
);
