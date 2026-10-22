import { createCron } from '@metorial/cron';
import { combineQueueProcessors, createQueue, hourlyPacedDelay } from '@metorial/queue';
import { UsageMetricModel, type UsageMetric } from '../models';
import { getUsageBackfillCutoff } from '../lib/backfillState';
import {
  decodeUsageBucketKey,
  floorToMinute,
  getUsageMetricId,
  parseUsageBucketHash
} from '../lib/bucket';
import {
  acknowledgeClaimedUsageBucket,
  claimUsageMinute,
  listClaimedUsageBuckets,
  listPendingUsageMinutes,
  parseClaimedUsageBucketKey,
  readClaimedUsageBucket
} from '../lib/buffer';
import { isUsageEnabled, usageDbConnect } from '../lib/connection';

let FLUSH_BATCH_SIZE = 500;
let FLUSH_WRITE_CHUNK_SIZE = 1000;
let FLUSH_GRACE_MS = 60_000;
let STUCK_CLAIM_AFTER_MS = 10 * 60_000;

let getFlushJobId = (claimedKey: string) => {
  let { minute, nonce } = parseClaimedUsageBucketKey(claimedKey);
  return `usage-flush-${minute}-${nonce}`;
};

export let usageFlushClaimQueue = createQueue<{}>({
  name: 'usage/flush/claim',
  workerOpts: { concurrency: 1 }
});

export let usageFlushBucketQueue = createQueue<{ claimedKey: string }>({
  name: 'usage/flush/bucket',
  workerOpts: { concurrency: 5 }
});

export let usageFlushCron = createCron(
  { name: 'usage/flush/cron', cron: '* * * * *' },
  async () => {
    if (!isUsageEnabled()) return;

    await usageFlushClaimQueue.add({});
  }
);

export let usageFlushClaimProcessor = usageFlushClaimQueue.process(async () => {
  let currentMinute = floorToMinute(Date.now());

  let minutes = await listPendingUsageMinutes({
    before: currentMinute - FLUSH_GRACE_MS,
    limit: FLUSH_BATCH_SIZE
  });

  let claimedKeys: string[] = [];
  for (let minute of minutes) {
    let claimedKey = await claimUsageMinute(minute);
    if (claimedKey) claimedKeys.push(claimedKey);
  }

  let stuckKeys = (await listClaimedUsageBuckets(FLUSH_BATCH_SIZE)).filter(
    key =>
      !claimedKeys.includes(key) &&
      parseClaimedUsageBucketKey(key).minute < currentMinute - STUCK_CLAIM_AFTER_MS
  );

  await usageFlushBucketQueue.addManyWithOps([
    ...claimedKeys.map(claimedKey => ({
      data: { claimedKey },
      opts: { id: getFlushJobId(claimedKey) }
    })),
    ...stuckKeys.map(claimedKey => ({
      data: { claimedKey },
      opts: { id: `${getFlushJobId(claimedKey)}-retry-${currentMinute}` }
    }))
  ]);

  if (minutes.length == FLUSH_BATCH_SIZE) {
    await usageFlushClaimQueue.add({}, hourlyPacedDelay());
  }
});

export let usageFlushBucketProcessor = usageFlushBucketQueue.process(async data => {
  let { minute, nonce } = parseClaimedUsageBucketKey(data.claimedKey);

  await usageDbConnect();

  // Minutes before the cutoff are covered by the backfill, so writing them would count twice.
  let cutoff = await getUsageBackfillCutoff();
  if (minute < cutoff.getTime()) {
    await acknowledgeClaimedUsageBucket(data.claimedKey);
    return;
  }

  let hash = await readClaimedUsageBucket(data.claimedKey);
  let buckets = [...parseUsageBucketHash(hash).entries()];

  let documents = buckets.map(([field, counters]): UsageMetric => {
    let key = decodeUsageBucketKey(field);

    return {
      _id: getUsageMetricId(['live', minute, nonce, field]),
      ts: new Date(minute),
      source: 'live',
      ...key,
      ...counters
    };
  });

  for (let i = 0; i < documents.length; i += FLUSH_WRITE_CHUNK_SIZE) {
    await UsageMetricModel.bulkWrite(
      documents.slice(i, i + FLUSH_WRITE_CHUNK_SIZE).map(document => ({
        updateOne: {
          filter: { _id: document._id },
          update: { $set: document },
          upsert: true
        }
      })),
      { ordered: false }
    );
  }

  await acknowledgeClaimedUsageBucket(data.claimedKey);
});

export let usageFlushProcessors = combineQueueProcessors([
  usageFlushCron,
  usageFlushClaimProcessor,
  usageFlushBucketProcessor
]);
