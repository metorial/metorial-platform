import { formatDuration, formatNumber, formatPercent } from '@metorial/chart';
import {
  MetricsGrid,
  MetricsPanel,
  MetricsSummary,
  MetricsToolbar,
  MetricsUnavailable,
  type MetricsSummaryItem
} from '@metorial/metrics-page';
import {
  useCurrentInstance,
  useInstanceUsageSummary,
  type DashboardInstancesUsageSummaryOutput
} from '@metorial/state';
import { Flex } from '@metorial/ui';
import React, { useMemo } from 'react';
import {
  toUsageFilterQuery,
  usageIntervals,
  usageMaxPoints,
  usageMaxSpanMs,
  usageRetentionMs,
  useUsageQueryParams,
  useUsageRange,
  type UsageFilter,
  type UsageKind,
  type UsageRange
} from './query';

export type UsageSummaryId =
  | 'tool_calls'
  | 'error_rate'
  | 'latency'
  | 'sessions'
  | 'connections'
  | 'connection_time'
  | 'session_errors'
  | 'auth_failures'
  | 'active_consumers'
  | 'active_agents';

type Totals = DashboardInstancesUsageSummaryOutput['total'];

let summaryKinds: Record<UsageSummaryId, UsageKind[]> = {
  tool_calls: ['tool_call'],
  error_rate: ['tool_call'],
  latency: ['tool_call'],
  sessions: ['session'],
  connections: ['connection'],
  connection_time: ['connection_time'],
  session_errors: ['session_error'],
  auth_failures: ['auth_event'],
  active_consumers: ['tool_call', 'connection'],
  active_agents: ['tool_call', 'connection']
};

let count = (n: number | undefined) => formatNumber(n ?? 0);
let duration = (ms: number | null | undefined) =>
  ms === null || ms === undefined ? '—' : formatDuration(ms);

let getSummaryItem = (
  id: UsageSummaryId,
  kind: (kind: UsageKind) => Totals | undefined,
  total: Totals | undefined
): MetricsSummaryItem => {
  if (id == 'tool_calls') {
    let totals = kind('tool_call');
    return {
      id,
      label: 'Tool calls',
      value: count(totals?.count),
      sub: `${count(totals?.errorCount)} failed`
    };
  }

  if (id == 'error_rate') {
    let totals = kind('tool_call');
    return {
      id,
      label: 'Error rate',
      value: totals?.count ? formatPercent(totals.errorRate) : '—'
    };
  }

  if (id == 'latency') {
    let totals = kind('tool_call');
    return {
      id,
      label: 'Avg tool latency',
      value: duration(totals?.durationMsAvg),
      sub: `Max ${duration(totals?.durationMsMax)}`
    };
  }

  if (id == 'sessions') return { id, label: 'Sessions', value: count(kind('session')?.count) };

  if (id == 'connections') {
    return { id, label: 'Connections', value: count(kind('connection')?.count) };
  }

  if (id == 'connection_time') {
    let totals = kind('connection_time');
    return {
      id,
      label: 'Connection time',
      value: duration(totals?.durationMsSum ?? 0),
      sub: totals?.count ? `Avg ${duration(totals.durationMsAvg)}` : undefined
    };
  }

  if (id == 'session_errors') {
    return { id, label: 'Session errors', value: count(kind('session_error')?.count) };
  }

  if (id == 'auth_failures') {
    let totals = kind('auth_event');
    return {
      id,
      label: 'Auth failures',
      value: count(totals?.errorCount),
      sub: `of ${count(totals?.count)} authentications`
    };
  }

  if (id == 'active_agents') {
    return { id, label: 'Active agents', value: count(total?.activeAgents) };
  }

  return { id, label: 'Active clients', value: count(total?.activeConsumers) };
};

let UsageSummaryStrip = ({
  filter,
  range,
  items
}: {
  filter?: UsageFilter;
  range: UsageRange;
  items: UsageSummaryId[];
}) => {
  let instance = useCurrentInstance();
  let kinds = useMemo(
    () => [...new Set(items.flatMap(item => summaryKinds[item]))],
    [items.join(',')]
  );
  let query = { ...toUsageFilterQuery(filter), from: range.from, to: range.to };

  let summary = useInstanceUsageSummary(instance.data?.id, { ...query, kind: kinds });
  let needsDistinct = items.includes('active_consumers') || items.includes('active_agents');
  let consumers = useInstanceUsageSummary(
    instance.data?.id,
    needsDistinct ? { ...query, kind: summaryKinds.active_consumers } : null
  );

  let kind = (k: UsageKind) => summary.data?.byKind.find(item => item.kind == k);

  return (
    <MetricsSummary
      columns={items.length <= 7 ? items.length : Math.ceil(items.length / 2)}
      loading={summary.isLoading || (needsDistinct && consumers.isLoading)}
      items={items.map(item => getSummaryItem(item, kind, consumers.data?.total))}
    />
  );
};

export let UsageSection = ({
  filter,
  summary,
  defaultPreset,
  defaultInterval,
  panel,
  title,
  description,
  children
}: {
  filter?: UsageFilter;
  summary?: UsageSummaryId[];
  defaultPreset?: string;
  defaultInterval?: string;
  panel?: boolean;
  title?: React.ReactNode;
  description?: React.ReactNode;
  children: (range: UsageRange) => React.ReactNode;
}) => {
  let [query, setQuery] = useUsageQueryParams({ defaultPreset, defaultInterval });
  let range = useUsageRange(query);

  let instance = useCurrentInstance();
  let probe = useInstanceUsageSummary(instance.data?.id, {
    ...toUsageFilterQuery(filter),
    kind: 'session',
    from: range.from,
    to: range.to
  });
  let unavailable = probe.error?.data.code == 'usage_unavailable';

  let toolbar = (
    <MetricsToolbar
      value={query}
      onChange={setQuery}
      intervals={usageIntervals}
      retentionMs={usageRetentionMs}
      maxSpanMs={usageMaxSpanMs}
      maxPoints={usageMaxPoints}
      justify={panel ? 'end' : undefined}
      intervalInPicker={panel}
    />
  );

  if (panel) {
    return (
      <MetricsPanel title={title} description={description} toolbar={toolbar}>
        {unavailable ? <MetricsUnavailable /> : children(range)}
      </MetricsPanel>
    );
  }

  return (
    <Flex direction="column" gap={20}>
      {toolbar}

      {unavailable ? (
        <MetricsUnavailable />
      ) : (
        <>
          {summary?.length ? (
            <UsageSummaryStrip filter={filter} range={range} items={summary} />
          ) : null}

          <MetricsGrid>{children(range)}</MetricsGrid>
        </>
      )}
    </Flex>
  );
};
