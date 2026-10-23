let MINUTE_MS = 60_000;
let HOUR_MS = 60 * MINUTE_MS;
let DAY_MS = 24 * HOUR_MS;

export let DEFAULT_TARGET_POINTS = 120;

export let usageIntervals = {
  '1m': MINUTE_MS,
  '5m': 5 * MINUTE_MS,
  '15m': 15 * MINUTE_MS,
  '1h': HOUR_MS,
  '6h': 6 * HOUR_MS,
  '12h': 12 * HOUR_MS,
  '1d': DAY_MS
} as const;

export type UsageInterval = keyof typeof usageIntervals;

export let usageIntervalValues = Object.keys(usageIntervals) as [
  UsageInterval,
  ...UsageInterval[]
];

export let resolveUsageInterval = (d: {
  from: Date;
  to: Date;
  interval?: UsageInterval;
  targetPoints?: number;
}) => {
  if (d.interval) return { interval: d.interval, intervalMs: usageIntervals[d.interval] };

  let spanMs = d.to.getTime() - d.from.getTime();
  let targetPoints = d.targetPoints ?? DEFAULT_TARGET_POINTS;

  let interval =
    usageIntervalValues.find(
      candidate => spanMs / usageIntervals[candidate] <= targetPoints
    ) ?? '1d';

  return { interval, intervalMs: usageIntervals[interval] };
};

export let getUsageBucketStarts = (d: { from: Date; to: Date; intervalMs: number }) => {
  let starts: number[] = [];
  let current = d.from.getTime() - (d.from.getTime() % d.intervalMs);

  while (current < d.to.getTime()) {
    starts.push(current);
    current += d.intervalMs;
  }

  return starts;
};
