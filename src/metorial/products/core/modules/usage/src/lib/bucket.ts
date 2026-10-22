import { createHash } from 'node:crypto';
import {
  usageDimensionKeys,
  type UsageBucketKey,
  type UsageCounters,
  type UsageDimensions,
  type UsageEvent
} from './types';

let MINUTE_MS = 60_000;

let counterSuffixes = {
  c: 'count',
  e: 'errorCount',
  d: 'durationMsSum',
  n: 'durationCount',
  x: 'durationMsMax'
} as const satisfies Record<string, keyof UsageCounters>;

export type UsageCounterSuffix = keyof typeof counterSuffixes;

export let floorToMinute = (ts: Date | number) => {
  let ms = typeof ts == 'number' ? ts : ts.getTime();
  return ms - (ms % MINUTE_MS);
};

export let normalizeUsageDimensions = (dims: UsageDimensions | undefined) => {
  let normalized: UsageDimensions = {};

  for (let key of usageDimensionKeys) {
    let value = dims?.[key];
    if (value !== undefined && value !== null && value !== '') normalized[key] = value;
  }

  return normalized;
};

export let encodeUsageBucketKey = (event: UsageEvent) =>
  JSON.stringify([
    event.instanceId,
    event.organizationId ?? null,
    event.kind,
    normalizeUsageDimensions(event.dims)
  ]);

export let decodeUsageBucketKey = (key: string): UsageBucketKey => {
  let [instanceId, organizationId, kind, dims] = JSON.parse(key);
  return { instanceId, organizationId, kind, dims };
};

export let emptyUsageCounters = (): UsageCounters => ({
  count: 0,
  errorCount: 0,
  durationMsSum: 0,
  durationCount: 0,
  durationMsMax: 0
});

export let parseUsageBucketHash = (hash: Record<string, string>) => {
  let buckets = new Map<string, UsageCounters>();

  for (let [field, rawValue] of Object.entries(hash)) {
    let separator = field.lastIndexOf('|');
    if (separator == -1) continue;

    let key = field.slice(0, separator);
    let counter = counterSuffixes[field.slice(separator + 1) as UsageCounterSuffix];
    if (!counter) continue;

    let counters = buckets.get(key) ?? emptyUsageCounters();
    counters[counter] = Number(rawValue) || 0;
    buckets.set(key, counters);
  }

  return buckets;
};

export let getUsageMetricId = (parts: (string | number)[]) =>
  createHash('sha1').update(parts.join('\u0000')).digest('hex');

export type UsageAccumulatedBucket = {
  minute: number;
  field: string;
  counters: UsageCounters;
};

export let accumulateUsageEvent = (
  buckets: Map<string, UsageAccumulatedBucket>,
  event: UsageEvent
) => {
  let minute = floorToMinute(event.ts ?? new Date());
  let field = encodeUsageBucketKey(event);
  let key = `${minute}:${field}`;

  let bucket = buckets.get(key);
  if (!bucket) {
    bucket = { minute, field, counters: emptyUsageCounters() };
    buckets.set(key, bucket);
  }

  bucket.counters.count += 1;
  if (event.isError) bucket.counters.errorCount += 1;

  if (event.durationMs !== undefined && event.durationMs !== null && event.durationMs >= 0) {
    let duration = Math.round(event.durationMs);

    bucket.counters.durationMsSum += duration;
    bucket.counters.durationCount += 1;
    bucket.counters.durationMsMax = Math.max(bucket.counters.durationMsMax, duration);
  }
};
