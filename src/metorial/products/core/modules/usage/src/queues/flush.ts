import { checkEdition } from '@metorial/editions';
import { createCron } from '@metorial/cron';
import { combineQueueProcessors, createQueue, hourlyPacedDelay } from '@metorial/queue';
import { floorToMinute } from '../lib/bucket';
import {
  claimUsageMinute,
  listClaimedUsageBuckets,
  listPendingUsageMinutes,
  parseClaimedUsageBucketKey
} from '../lib/buffer';
import { isUsageEnabled } from '../lib/connection';

let FLUSH_BATCH_SIZE = 500;
let FLUSH_GRACE_MS = 60_000;
let STUCK_CLAIM_AFTER_MS = 10 * 60_000;

let storage = checkEdition('cloud')
  ? await import('../lib/flushCloud')
  : await import('../lib/postgres');

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
  await storage.flushUsageBucket(data.claimedKey);
});

export let usageFlushProcessors = combineQueueProcessors([
  usageFlushCron,
  usageFlushClaimProcessor,
  usageFlushBucketProcessor
]);
