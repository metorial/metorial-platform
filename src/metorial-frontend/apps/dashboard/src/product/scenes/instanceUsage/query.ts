import {
  applyMetricsQuery,
  defaultMetricsIntervals,
  MetricsQuery,
  parseMetricsQuery,
  resolveMetricsInterval,
  useMetricsTimeRange
} from '@metorial/metrics-page';
import type { DashboardInstancesUsageTimelineQuery } from '@metorial/state';
import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

let MINUTE = 60 * 1000;
let DAY = 24 * 60 * MINUTE;

export let usageRetentionMs = 30 * DAY;
export let usageMaxSpanMs = 31 * DAY;
export let usageMaxPoints = 1500;

export type UsageInterval = NonNullable<DashboardInstancesUsageTimelineQuery['interval']>;
export type UsageKind = Extract<DashboardInstancesUsageTimelineQuery['kind'], string>;
export type UsageGroupBy = NonNullable<DashboardInstancesUsageTimelineQuery['groupBy']>;

export let usageIntervalMs: Record<UsageInterval, number> = {
  '1m': MINUTE,
  '5m': 5 * MINUTE,
  '15m': 15 * MINUTE,
  '1h': 60 * MINUTE,
  '6h': 6 * 60 * MINUTE,
  '12h': 12 * 60 * MINUTE,
  '1d': DAY
};

export let usageIntervals = defaultMetricsIntervals.filter(
  interval => interval.id in usageIntervalMs
);

type UsageFilterValue = string | string[];

export type UsageFilter = {
  providerId?: UsageFilterValue;
  deploymentId?: UsageFilterValue;
  consumerId?: UsageFilterValue;
  magicMcpServerId?: UsageFilterValue;
  integrationId?: UsageFilterValue;
  errorType?: string[];
};

export let toUsageFilterQuery = (filter: UsageFilter | undefined) => ({
  providerId: filter?.providerId,
  deploymentId: filter?.deploymentId,
  consumerId: filter?.consumerId,
  magicMcpServerId: filter?.magicMcpServerId,
  integrationId: filter?.integrationId,
  errorType: filter?.errorType
});

export type UsageRange = {
  from: Date;
  to: Date;
  interval: UsageInterval | undefined;
};

export let useUsageRange = (
  query: MetricsQuery,
  opts: { refreshIntervalMs?: number } = {}
) => {
  let range = useMetricsTimeRange(query.range, {
    retentionMs: usageRetentionMs,
    maxSpanMs: usageMaxSpanMs,
    refreshIntervalMs: opts.refreshIntervalMs
  });

  return useMemo<UsageRange>(() => {
    let interval = resolveMetricsInterval(query.interval, usageIntervals, range, {
      maxPoints: usageMaxPoints
    });

    return {
      from: range.from,
      to: range.to,
      interval: interval?.id as UsageInterval | undefined
    };
  }, [range, query.interval]);
};

export let useUsageQueryParams = (opts: { defaultPreset?: string } = {}) => {
  let [params, setParams] = useSearchParams();

  let query = parseMetricsQuery(params, {
    intervals: usageIntervals,
    defaultQuery: {
      range: { type: 'preset', preset: opts.defaultPreset ?? '24h' },
      interval: 'auto'
    }
  });

  let setQuery = (next: MetricsQuery) => setParams(applyMetricsQuery(params, next));

  return [query, setQuery] as const;
};
