import { platformLimitMetrics, type PlatformLimitMetric } from '@mtsrc/ai-gateway-spec';
import { microUsdPerUsd } from './rules';
import type { BucketUpdate, LimitStore } from './store';

export let tripBucketMs = 5 * 60_000;
export let usageBucketMs = 60 * 60_000;

// Self-hosted gateways have nobody draining events, so undrained buckets must expire on their own.
let retentionMs = 2 * 24 * 60 * 60_000;

let floorTo = (value: number, size: number) => Math.floor(value / size) * size;

let field = (kind: string, projectId: string, metric: PlatformLimitMetric) =>
  `${kind}|${projectId}|${metric}`;

let parseField = (raw: string) => {
  let [kind, projectId, metric] = raw.split('|');
  if (!kind || !projectId || !platformLimitMetrics.includes(metric as PlatformLimitMetric)) {
    return null;
  }

  return { kind, projectId, metric: metric as PlatformLimitMetric };
};

let reportedAmount = (metric: PlatformLimitMetric, value: number) =>
  metric == 'metorial_spend_usd' ? value / microUsdPerUsd : value;

export type PlatformLimitTrip = {
  projectId: string;
  metric: PlatformLimitMetric;
  count: number;
  firstTrippedAt: number;
  lastTrippedAt: number;
};

export type PlatformLimitUsage = {
  projectId: string;
  metric: PlatformLimitMetric;
  used: number;
  denied: number;
};

export type PlatformLimitEventDrain = {
  trips: { bucketStart: number; entries: PlatformLimitTrip[] }[];
  usage: { hourStart: number; entries: PlatformLimitUsage[] }[];
};

export type LimitEventRecorder = ReturnType<typeof createLimitEventRecorder>;

export let createLimitEventRecorder = (d: {
  store: LimitStore;
  now?: () => number;
  namespace?: string;
}) => {
  let now = d.now ?? Date.now;
  let namespace = d.namespace ?? 'aigw:lim';

  let tripIndex = `${namespace}:{trips}`;
  let usageIndex = `${namespace}:{usage}`;

  let tripBucket = (start: number) => `${tripIndex}:${start}`;
  let usageBucket = (start: number) => `${usageIndex}:${start}`;

  let updateUsage = async (at: number, updates: BucketUpdate[]) => {
    if (!updates.length) return;

    let hourStart = floorTo(at, usageBucketMs);
    await d.store.updateBucket({
      index: usageIndex,
      key: usageBucket(hourStart),
      score: hourStart,
      updates,
      expiresAt: hourStart + usageBucketMs + retentionMs,
      pruneBefore: at - retentionMs
    });
  };

  let readTrips = async (bucketStart: number) => {
    let entries = new Map<string, PlatformLimitTrip>();

    for (let [raw, value] of Object.entries(
      await d.store.readBucket(tripBucket(bucketStart))
    )) {
      let parsed = parseField(raw);
      if (!parsed) continue;

      let id = `${parsed.projectId}|${parsed.metric}`;
      let entry = entries.get(id) ?? {
        projectId: parsed.projectId,
        metric: parsed.metric,
        count: 0,
        firstTrippedAt: bucketStart,
        lastTrippedAt: bucketStart
      };

      if (parsed.kind == 'c') entry.count = value;
      if (parsed.kind == 'f') entry.firstTrippedAt = value;
      if (parsed.kind == 'l') entry.lastTrippedAt = value;
      entries.set(id, entry);
    }

    return [...entries.values()].filter(entry => entry.count > 0);
  };

  let readUsage = async (hourStart: number) => {
    let entries = new Map<string, PlatformLimitUsage>();

    for (let [raw, value] of Object.entries(
      await d.store.readBucket(usageBucket(hourStart))
    )) {
      let parsed = parseField(raw);
      if (!parsed) continue;

      let id = `${parsed.projectId}|${parsed.metric}`;
      let entry = entries.get(id) ?? {
        projectId: parsed.projectId,
        metric: parsed.metric,
        used: 0,
        denied: 0
      };

      if (parsed.kind == 'u') entry.used = reportedAmount(parsed.metric, value);
      if (parsed.kind == 'd') entry.denied = value;
      entries.set(id, entry);
    }

    return [...entries.values()];
  };

  return {
    used: async (e: {
      projectId: string;
      amounts: Partial<Record<PlatformLimitMetric, number>>;
    }) => {
      let updates = Object.entries(e.amounts)
        .filter(([, amount]) => amount && amount > 0)
        .map(([metric, amount]) => ({
          op: 'increment' as const,
          field: field('u', e.projectId, metric as PlatformLimitMetric),
          value: amount!
        }));

      await updateUsage(now(), updates);
    },

    denied: async (e: { projectId: string; metric: PlatformLimitMetric }) => {
      let at = now();
      let bucketStart = floorTo(at, tripBucketMs);

      await Promise.all([
        d.store.updateBucket({
          index: tripIndex,
          key: tripBucket(bucketStart),
          score: bucketStart,
          updates: [
            { op: 'increment', field: field('c', e.projectId, e.metric), value: 1 },
            { op: 'setIfAbsent', field: field('f', e.projectId, e.metric), value: at },
            { op: 'set', field: field('l', e.projectId, e.metric), value: at }
          ],
          expiresAt: bucketStart + tripBucketMs + retentionMs,
          pruneBefore: at - retentionMs
        }),
        updateUsage(at, [
          { op: 'increment', field: field('d', e.projectId, e.metric), value: 1 }
        ])
      ]);
    },

    drain: async (e: {
      tripsBefore: number;
      usageBefore: number;
    }): Promise<PlatformLimitEventDrain> => {
      let tripBuckets = await d.store.listBuckets({ index: tripIndex, before: e.tripsBefore });
      let usageHours = await d.store.listBuckets({ index: usageIndex, before: e.usageBefore });

      return {
        trips: await Promise.all(
          tripBuckets.map(async bucketStart => ({
            bucketStart,
            entries: await readTrips(bucketStart)
          }))
        ),
        usage: await Promise.all(
          usageHours.map(async hourStart => ({
            hourStart,
            entries: await readUsage(hourStart)
          }))
        )
      };
    },

    ack: async (e: { tripBuckets: number[]; usageHours: number[] }) => {
      await d.store.deleteBuckets({
        index: tripIndex,
        buckets: e.tripBuckets.map(score => ({ key: tripBucket(score), score }))
      });
      await d.store.deleteBuckets({
        index: usageIndex,
        buckets: e.usageHours.map(score => ({ key: usageBucket(score), score }))
      });
    }
  };
};
