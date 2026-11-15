import { UsageMetricModel, type UsageMetric } from '../models';
import { getUsageBackfillCutoff } from './backfillState';
import {
  decodeUsageBucketKey,
  floorToMinute,
  getUsageMetricId,
  parseUsageBucketHash
} from './bucket';
import {
  acknowledgeClaimedUsageBucket,
  parseClaimedUsageBucketKey,
  readClaimedUsageBucket
} from './buffer';
import { usageDbConnect } from './connection';
import {
  USAGE_MESSAGE_BACKFILL_ID,
  USAGE_MESSAGE_REVISION,
  usageMessageKinds
} from './messageRevision';

let FLUSH_WRITE_CHUNK_SIZE = 1000;

export let flushUsageBucket = async (claimedKey: string) => {
  let { minute, nonce } = parseClaimedUsageBucketKey(claimedKey);

  await usageDbConnect();

  let [cutoff, messageCutoff] = await Promise.all([
    getUsageBackfillCutoff(),
    getUsageBackfillCutoff(USAGE_MESSAGE_BACKFILL_ID)
  ]);

  let hash = await readClaimedUsageBucket(claimedKey);
  let buckets = [...parseUsageBucketHash(hash).entries()];

  let documents = buckets.flatMap(([field, counters]): UsageMetric[] => {
    let key = decodeUsageBucketKey(field);
    let isMessage = usageMessageKinds.includes(key.kind);

    // Rebuilt messages have their own cutoff so they cannot overlap with live counters.
    if (minute < (isMessage ? messageCutoff : cutoff).getTime()) return [];

    return [
      {
        _id: getUsageMetricId(['live', minute, nonce, field]),
        ts: new Date(minute),
        source: 'live',
        ...(isMessage ? { messageRevision: USAGE_MESSAGE_REVISION } : {}),
        ...key,
        ...counters
      }
    ];
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

  await acknowledgeClaimedUsageBucket(claimedKey);
};
