import {
  formatNumber,
  type ChartSelection,
  type ChartSeries,
  type ValueFormatter
} from '@metorial/chart';
import {
  EventsChartCard,
  MetricChartCard,
  type EventsChartBucket,
  type EventsChartVariant,
  type MetricChartCardSpan
} from '@metorial/metrics-page';
import {
  useCurrentInstance,
  useInstanceUsageSummary,
  useInstanceUsageTimeline
} from '@metorial/state';
import { getLink, Skeleton, Text, theme, Title } from '@metorial/ui';
import React, { useMemo, useState } from 'react';
import styled from 'styled-components';
import { useUsageLogsLink, type UsageLogsTarget } from './links';
import {
  getUnknownGroupName,
  isMcpProtocolMethod,
  UsageConsumerName,
  useUsageGroupHref,
  useUsageGroupNames
} from './names';
import {
  toUsageFilterQuery,
  usageIntervalMs,
  type UsageFilter,
  type UsageGroupBy,
  type UsageKind,
  type UsageRange
} from './query';
import {
  getUsagePointsForKinds,
  isErrorUsageKinds,
  usageEventsSeries,
  usageGroupedSeries,
  usageMetricSeries,
  type UsageEventsSegment,
  type UsagePoint,
  type UsageTimeline
} from './series';

export let getUsageErrorMessage = (error: { data?: { code?: string } } | null | undefined) => {
  if (!error) return undefined;
  if (error.data?.code == 'usage_unavailable') {
    return 'Usage metrics are temporarily unavailable.';
  }
  return 'Usage metrics could not be loaded.';
};

let useUsageTimeline = (d: {
  filter?: UsageFilter;
  range: UsageRange;
  kinds: UsageKind[];
  groupBy?: UsageGroupBy;
  maxSeries?: number;
}) => {
  let instance = useCurrentInstance();

  return useInstanceUsageTimeline(instance.data?.id, {
    ...toUsageFilterQuery(d.filter),
    kind: d.kinds,
    from: d.range.from,
    to: d.range.to,
    interval: d.range.interval,
    groupBy: d.groupBy,
    maxSeries: d.maxSeries
  });
};

let getIntervalMs = (timeline: UsageTimeline | null | undefined) =>
  timeline ? usageIntervalMs[timeline.interval] : undefined;

export type UsageEventsToggle = {
  id: string;
  label: string;
  kinds: UsageKind[];
};

export type UsageEventsCardProps = {
  title: React.ReactNode;
  info?: React.ReactNode;
  filter?: UsageFilter;
  range: UsageRange;
  kinds: UsageKind[];
  toggles?: UsageEventsToggle[];
  mode?: 'status' | 'count' | 'group';
  groupBy?: UsageGroupBy;
  countLabel?: string;
  labels?: { success?: string; error?: string };
  segments?: UsageEventsSegment[];
  variant?: EventsChartVariant;
  hint?: React.ReactNode;
  selection?: ChartSelection;
  linkTarget?: UsageLogsTarget;
  collapseKey?: string;
  height?: number;
  span?: MetricChartCardSpan;
  actions?: React.ReactNode;
};

let logsClickHints: Record<UsageLogsTarget, string> = {
  toolCalls: 'Click to view tool calls',
  sessions: 'Click to view sessions',
  connections: 'Click to view connections'
};

export let UsageEventsCard = ({
  title,
  info,
  filter,
  range,
  kinds,
  toggles,
  mode = 'status',
  groupBy,
  countLabel,
  labels,
  segments,
  variant,
  hint,
  selection,
  linkTarget,
  collapseKey,
  height,
  span,
  actions
}: UsageEventsCardProps) => {
  let [toggle, setToggle] = useState(toggles?.[0]?.id ?? '');
  let activeKinds = toggles?.find(item => item.id == toggle)?.kinds ?? kinds;

  let timeline = useUsageTimeline({
    filter,
    range,
    kinds,
    groupBy: mode == 'group' ? groupBy : toggles ? 'kind' : undefined,
    maxSeries: mode == 'group' ? 8 : undefined
  });

  let groupIds = (timeline.data?.series ?? []).flatMap(item =>
    !item.isOther && item.group ? [item.group] : []
  );
  let getGroupName = useUsageGroupNames(mode == 'group' ? groupBy : undefined, groupIds);

  let series = useMemo<ChartSeries[]>(() => {
    let data = timeline.data;
    if (!data) return [];

    if (mode == 'group') {
      return usageGroupedSeries(data, {
        getName: getGroupName,
        unknownName: getUnknownGroupName(groupBy),
        palette: isErrorUsageKinds(kinds) ? 'error' : 'default'
      });
    }

    let points = toggles ? getUsagePointsForKinds(data, activeKinds) : data.total;

    if (mode == 'count') {
      return [
        usageMetricSeries(points, {
          id: 'count',
          name: countLabel ?? 'Events',
          color: 'blue',
          value: point => point.count
        })
      ];
    }

    return usageEventsSeries(points, labels, segments);
  }, [
    segments?.join(','),
    timeline.data,
    mode,
    groupBy,
    getGroupName,
    toggle,
    countLabel,
    labels?.success,
    labels?.error
  ]);

  let openLogs = useUsageLogsLink(linkTarget ?? 'toolCalls', filter);
  let onBucketClick = linkTarget
    ? (bucket: EventsChartBucket, seriesId?: string) =>
        openLogs(bucket, mode == 'status' ? seriesId : undefined)
    : undefined;

  let totalLabel =
    mode == 'group' ? 'total' : typeof title == 'string' ? title.toLowerCase() : undefined;

  return (
    <EventsChartCard
      title={title}
      info={info}
      series={series}
      domain={range}
      intervalMs={getIntervalMs(timeline.data)}
      height={height}
      span={span}
      actions={actions}
      loading={timeline.isLoading}
      error={getUsageErrorMessage(timeline.error)}
      collapseKey={collapseKey}
      totalLabel={totalLabel}
      variant={variant}
      hint={hint}
      selection={selection}
      clickHint={linkTarget ? logsClickHints[linkTarget] : undefined}
      onBucketClick={onBucketClick}
      filter={
        toggles
          ? {
              value: toggle,
              onChange: setToggle,
              items: toggles.map(item => ({ id: item.id, label: item.label }))
            }
          : undefined
      }
    />
  );
};

export type UsageLineMetric = {
  id: string;
  name: string;
  value: (point: UsagePoint) => number | null;
  style?: ChartSeries['style'];
};

export let UsageLineCard = ({
  title,
  description,
  filter,
  range,
  kinds,
  metrics,
  valueFormatter,
  span,
  bare
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  filter?: UsageFilter;
  range: UsageRange;
  kinds: UsageKind[];
  metrics: UsageLineMetric[];
  valueFormatter?: ValueFormatter;
  span?: MetricChartCardSpan;
  bare?: boolean;
}) => {
  let timeline = useUsageTimeline({ filter, range, kinds });

  let series = useMemo(
    () =>
      timeline.data
        ? metrics.map(metric =>
            usageMetricSeries(timeline.data!.total, {
              id: metric.id,
              name: metric.name,
              style: metric.style ?? 'line',
              value: metric.value
            })
          )
        : [],
    [timeline.data, metrics]
  );

  return (
    <MetricChartCard
      title={title}
      description={description}
      span={span}
      bare={bare}
      series={series}
      xAxis="time"
      domain={range}
      yMin={0}
      valueFormatter={valueFormatter ?? (value => formatNumber(value))}
      loading={timeline.isLoading}
      error={getUsageErrorMessage(timeline.error)}
    />
  );
};

let Card = styled.section<{ $span: MetricChartCardSpan }>`
  grid-column: ${({ $span }) => ($span == 'full' ? '1 / -1' : 'auto')};
  display: flex;
  flex-direction: column;
  min-width: 0;
  border: 1px solid ${theme.colors.gray400};
  border-radius: 8px;
  background: ${theme.colors.gray100};
  box-shadow: ${theme.shadows.small};
`;

let Header = styled.header`
  display: flex;
  flex-direction: column;
  padding: 10px 18px 10px 18px;
`;

let Content = styled.div`
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 2px;
  margin: 0 -1px -1px -1px;
  padding: 10px;
  min-height: 120px;
  border: 1px solid ${theme.colors.gray400};
  border-radius: 8px;
  background: ${theme.colors.background};
`;

let Row = styled.div`
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 7px 10px;
  border-radius: 6px;
  overflow: hidden;
  color: inherit;
  text-decoration: none;
`;

let RowBar = styled.div<{ $ratio: number; $error: boolean }>`
  position: absolute;
  inset: 0 auto 0 0;
  width: ${({ $ratio }) => Math.max(0.5, $ratio * 100)}%;
  background: ${({ $error }) => ($error ? theme.colors.red300 : theme.colors.blue300)};
  border-radius: 6px;
`;

let RowContent = styled.div`
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  width: 100%;
  min-width: 0;
`;

let RowValues = styled.div`
  display: flex;
  align-items: baseline;
  gap: 8px;
  flex-shrink: 0;
`;

let Empty = styled.div`
  display: flex;
  flex: 1;
  align-items: center;
  justify-content: center;
`;

export let UsageTopListCard = ({
  title,
  description,
  filter,
  range,
  kinds,
  groupBy,
  limit = 8,
  span = 'half',
  showErrors = true,
  valueFormatter
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  filter?: UsageFilter;
  range: UsageRange;
  kinds: UsageKind[];
  groupBy: UsageGroupBy;
  limit?: number;
  span?: MetricChartCardSpan;
  showErrors?: boolean;
  valueFormatter?: (value: { count: number; durationMsSum: number }) => string;
}) => {
  let instance = useCurrentInstance();
  let summary = useInstanceUsageSummary(instance.data?.id, {
    ...toUsageFilterQuery(filter),
    kind: kinds,
    from: range.from,
    to: range.to,
    groupBy,
    maxSeries: groupBy == 'tool' ? limit + 20 : limit
  });
  let getHref = useUsageGroupHref();
  let Link = getLink();
  let isError = isErrorUsageKinds(kinds);

  let rows = (summary.data?.top ?? [])
    .filter(row => !row.isOther && row.group)
    .filter(row => groupBy != 'tool' || !isMcpProtocolMethod(row.group!))
    .slice(0, limit);
  let getName = useUsageGroupNames(
    groupBy,
    rows.map(row => row.group!)
  );
  let max = Math.max(1, ...rows.map(row => row.count));
  let error = getUsageErrorMessage(summary.error);

  return (
    <Card $span={span}>
      <Header>
        <Title as="h2" size="2" weight="strong">
          {title}
        </Title>
        {description ? (
          <Text size="1" weight="strong" color="gray600">
            {description}
          </Text>
        ) : null}
      </Header>

      <Content>
        {summary.isLoading ? (
          Array.from({ length: 4 }, (_, i) => (
            <Row key={i}>
              <Skeleton active>
                <Text size="2">Loading entry name</Text>
              </Skeleton>
            </Row>
          ))
        ) : error ? (
          <Empty>
            <Text size="2" color="gray600">
              {error}
            </Text>
          </Empty>
        ) : !rows.length ? (
          <Empty>
            <Text size="2" color="gray600">
              No data for this range.
            </Text>
          </Empty>
        ) : (
          rows.map(row => {
            let href = getHref(groupBy, row.group!);
            let content = (
              <>
                <RowBar $ratio={row.count / max} $error={isError} />
                <RowContent>
                  <Text size="2" weight="medium" truncate>
                    {groupBy == 'consumer' ? (
                      <UsageConsumerName id={row.group!} />
                    ) : (
                      (getName(row.group!) ?? row.group)
                    )}
                  </Text>
                  <RowValues>
                    {showErrors && row.errorCount ? (
                      <Text size="1" color="red700">
                        {formatNumber(row.errorCount)} errors
                      </Text>
                    ) : null}
                    <Text size="2" weight="strong">
                      {valueFormatter ? valueFormatter(row) : formatNumber(row.count)}
                    </Text>
                  </RowValues>
                </RowContent>
              </>
            );

            return href ? (
              <Row key={row.group} as={Link} to={href}>
                {content}
              </Row>
            ) : (
              <Row key={row.group}>{content}</Row>
            );
          })
        )}
      </Content>
    </Card>
  );
};
