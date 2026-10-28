import { createCron } from '@lowerdeck/cron';
import { combineQueueProcessors, createQueue, hourlyPacedDelay } from '@lowerdeck/queue';
import { db } from '@metorial-subspace/db';
import { env } from '../env';
import { internalSecurityReviewGateService } from '../internal/securityReviewGate';
import { internalSecurityReviewSubjectService } from '../internal/securityReviewSubject';
import { resolveUsageBaseRevision } from '../lib/usage/base';
import { collectUsageEvidence } from '../lib/usage/collect';
import { findMaterialUsageChanges } from '../lib/usage/eligibility';
import {
  MIN_USAGE_CALLS,
  USAGE_REVIEW_FIRST_RUN_DELAY_MS,
  USAGE_REVIEW_MIN_INTERVAL_MS
} from '../lib/usage/policy';
import { USAGE_WINDOW_DAYS } from '../lib/usage/stats';
import { enqueueSecurityReview } from './run';

let SCAN_BATCH_SIZE = 500;
let MAX_PAIRS_PER_TENANT = 200;

export let usageScanTenantsQueue = createQueue<{ cursor?: string }>({
  name: 'sub/srev/usage/scan/tenants',
  redisUrl: env.service.REDIS_URL,
  workerOpts: { concurrency: 1 }
});

export let usageScanTenantQueue = createQueue<{ tenantId: string }>({
  name: 'sub/srev/usage/scan/tenant',
  redisUrl: env.service.REDIS_URL,
  workerOpts: { concurrency: 5, limiter: { max: 5, duration: 1000 } }
});

export let usageScanPairQueue = createQueue<{ instanceOid: string; providerOid: string }>({
  name: 'sub/srev/usage/scan/pair',
  redisUrl: env.service.REDIS_URL,
  workerOpts: { concurrency: 5, limiter: { max: 10, duration: 1000 } }
});

let usageScanCron = createCron(
  { name: 'sub/srev/usage/scan/cron', redisUrl: env.service.REDIS_URL, cron: '0 */6 * * *' },
  async () => {
    await usageScanTenantsQueue.add({});
  }
);

let usageScanTenantsProcessor = usageScanTenantsQueue.process(async job => {
  let tenants = await db.tenant.findMany({
    where: {
      usageReviewsEnabled: true,
      aiAnalysisEnabled: true,
      id: job.cursor ? { gt: job.cursor } : undefined
    },
    orderBy: { id: 'asc' },
    take: SCAN_BATCH_SIZE,
    select: { id: true }
  });
  if (!tenants.length) return;

  await usageScanTenantQueue.addMany(tenants.map(tenant => ({ tenantId: tenant.id })));

  if (tenants.length == SCAN_BATCH_SIZE) {
    await usageScanTenantsQueue.add(
      { cursor: tenants[tenants.length - 1]!.id },
      hourlyPacedDelay()
    );
  }
});

let usageScanTenantProcessor = usageScanTenantQueue.process(async job => {
  let tenant = await db.tenant.findUnique({
    where: { id: job.tenantId },
    select: { oid: true }
  });
  if (!tenant) return;

  if (
    !(await internalSecurityReviewGateService.isUsageReviewEnabled({ tenantOid: tenant.oid }))
  ) {
    return;
  }

  let since = new Date(Date.now() - USAGE_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  let pairs = await db.$queryRaw<{ instanceOid: bigint; providerOid: bigint }[]>`
    SELECT "instanceOid", "providerOid"
    FROM "ProviderToolUsageHourly"
    WHERE "tenantOid" = ${tenant.oid} AND "hour" >= ${since}
    GROUP BY "instanceOid", "providerOid"
    HAVING sum("calls") >= ${MIN_USAGE_CALLS}
    LIMIT ${MAX_PAIRS_PER_TENANT}
  `;
  if (!pairs.length) return;

  await usageScanPairQueue.addMany(
    pairs.map(pair => ({
      instanceOid: pair.instanceOid.toString(),
      providerOid: pair.providerOid.toString()
    }))
  );
});

let usageScanPairProcessor = usageScanPairQueue.process(async job => {
  let instanceOid = BigInt(job.instanceOid);
  let providerOid = BigInt(job.providerOid);

  let review = await internalSecurityReviewSubjectService.ensureUsageReview({
    instanceOid,
    providerOid
  });
  if (!review || review.status != 'active') return;

  let baseRevision = await resolveUsageBaseRevision({ review });
  if (!baseRevision) return;

  let current = review.currentRevisionOid
    ? await db.securityReviewRevision.findUnique({ where: { oid: review.currentRevisionOid } })
    : null;

  if (!current) {
    await enqueueSecurityReview({
      reviewId: review.id,
      trigger: 'usage_threshold',
      reason: 'Enough usage was observed for a usage review.',
      delayMs: USAGE_REVIEW_FIRST_RUN_DELAY_MS
    });
    return;
  }

  let lastRunAt = current.completedAt ?? current.createdAt;
  if (Date.now() - lastRunAt.getTime() < USAGE_REVIEW_MIN_INTERVAL_MS) return;

  let usage = await collectUsageEvidence({
    review: { instanceOid, providerOid },
    baseRevision
  });
  let previous = current.context?.usage;

  let reasons = previous
    ? findMaterialUsageChanges({ previous, current: usage.snapshot })
    : ['No usage snapshot was recorded for the previous review.'];
  if (!reasons.length) return;

  await enqueueSecurityReview({
    reviewId: review.id,
    trigger: 'usage_changed',
    reason: reasons.join(' '),
    delayMs: USAGE_REVIEW_FIRST_RUN_DELAY_MS
  });
});

export let securityReviewUsageScanProcessors = combineQueueProcessors([
  usageScanCron,
  usageScanTenantsProcessor,
  usageScanTenantProcessor,
  usageScanPairProcessor
]);
