import { usageService, type UsageEvent } from '../src';
import { getUsageBackfillCutoff } from '../src/lib/backfillState';
import { floorToMinute } from '../src/lib/bucket';
import { claimUsageMinute } from '../src/lib/buffer';
import { usageFlushBucketQueue } from '../src/queues/flush';

export let recordUsageEvents = async (events: Omit<UsageEvent, 'ts'>[]) => {
  await getUsageBackfillCutoff();

  let ts = new Date();
  for (let event of events) {
    await usageService.record({ ...event, ts });
  }

  // Flush this minute explicitly so tests exercise persistence without waiting for the cron.
  let claimedKey = await claimUsageMinute(floorToMinute(ts));
  if (claimedKey) await usageFlushBucketQueue.add({ claimedKey });
};
