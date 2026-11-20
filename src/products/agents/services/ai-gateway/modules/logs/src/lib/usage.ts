import { badRequestError, ServiceError } from '@lowerdeck/error';

let minuteMs = 60 * 1000;
let hourMs = 60 * minuteMs;

export let usageIntervals = {
  '5m': 5 * minuteMs,
  '15m': 15 * minuteMs,
  '1h': hourMs,
  '6h': 6 * hourMs,
  '1d': 24 * hourMs
} as const;

export type UsageInterval = keyof typeof usageIntervals;

export let usageIntervalSlugs = Object.keys(usageIntervals) as UsageInterval[];

let targetBuckets = 500;
let maxBuckets = 1500;

export type UsageRange = {
  from: Date;
  to: Date;
  interval: UsageInterval;
  intervalMs: number;
};

export type UsageBucketRow = {
  _id: number;
  requests: number;
  succeeded: number;
  failed: number;
  cancelled: number;
  rejected: number;
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
  costUsd: number;
  platformCostUsd: number;
  totalLatencyMs: number;
};

// Buckets are fixed-width and aligned to the Unix epoch, so `1d` buckets are UTC days.
export let resolveUsageRange = (d: {
  from: Date;
  to: Date;
  interval?: UsageInterval;
}): UsageRange => {
  let rangeMs = d.to.getTime() - d.from.getTime();
  if (!(rangeMs > 0)) {
    throw new ServiceError(badRequestError({ message: '`to` must be after `from`.' }));
  }

  let interval =
    d.interval ??
    usageIntervalSlugs.find(slug => rangeMs / usageIntervals[slug] <= targetBuckets) ??
    '1d';
  let intervalMs = usageIntervals[interval];

  let from = new Date(Math.floor(d.from.getTime() / intervalMs) * intervalMs);
  if (Math.ceil((d.to.getTime() - from.getTime()) / intervalMs) > maxBuckets) {
    throw new ServiceError(
      badRequestError({
        message: `The range spans more than ${maxBuckets} ${interval} buckets; pick a larger interval.`
      })
    );
  }

  return { from, to: d.to, interval, intervalMs };
};

let sumIf = (condition: unknown, value: unknown = 1) => ({
  $sum: { $cond: [condition, value, 0] }
});

let orZero = (path: string) => ({ $ifNull: [path, 0] });

// Bucketing uses epoch arithmetic instead of `$dateTrunc`, which DocumentDB 5 lacks.
export let usageBucketStages = (intervalMs: number) => {
  let receivedAtMs = { $toLong: '$timing.receivedAt' };
  let decisionCost = orZero('$virtualModel.decision.costUsd');
  let billedCost = orZero('$billedCost.totalUsd');

  return [
    {
      $group: {
        _id: { $subtract: [receivedAtMs, { $mod: [receivedAtMs, intervalMs] }] },

        requests: { $sum: 1 },
        succeeded: sumIf({ $eq: ['$status', 'succeeded'] }),
        failed: sumIf({ $eq: ['$status', 'failed'] }),
        cancelled: sumIf({ $eq: ['$status', 'cancelled'] }),
        rejected: sumIf({ $eq: ['$status', 'rejected'] }),

        inputTokens: { $sum: orZero('$usage.input.total') },
        cachedInputTokens: { $sum: orZero('$usage.input.cacheRead') },
        outputTokens: { $sum: orZero('$usage.output.total') },

        costUsd: { $sum: { $add: [billedCost, decisionCost] } },
        platformCostUsd: {
          $sum: {
            $add: [
              { $cond: [{ $eq: ['$route.connectionOwner', 'platform'] }, billedCost, 0] },
              {
                $cond: [
                  { $eq: ['$virtualModel.decision.source', 'platform'] },
                  decisionCost,
                  0
                ]
              }
            ]
          }
        },

        totalLatencyMs: { $sum: orZero('$timing.totalMs') }
      }
    },
    { $sort: { _id: 1 as const } }
  ];
};

export let buildUsageTimeline = (range: UsageRange, rows: UsageBucketRow[]) => {
  let rowsByStart = new Map(rows.map(row => [Number(row._id), row]));

  let buckets = [];
  for (
    let start = range.from.getTime();
    start < range.to.getTime();
    start += range.intervalMs
  ) {
    let row = rowsByStart.get(start);

    buckets.push({
      start: new Date(start),
      requests: row?.requests ?? 0,
      succeeded: row?.succeeded ?? 0,
      failed: row?.failed ?? 0,
      cancelled: row?.cancelled ?? 0,
      rejected: row?.rejected ?? 0,
      inputTokens: row?.inputTokens ?? 0,
      cachedInputTokens: row?.cachedInputTokens ?? 0,
      outputTokens: row?.outputTokens ?? 0,
      costUsd: row?.costUsd ?? 0,
      platformCostUsd: row?.platformCostUsd ?? 0,
      averageLatencyMs: row?.requests ? Math.round(row.totalLatencyMs / row.requests) : null
    });
  }

  return {
    interval: range.interval,
    from: range.from,
    to: range.to,
    buckets
  };
};
