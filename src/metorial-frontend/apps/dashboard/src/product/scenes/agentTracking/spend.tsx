import {
  Chart,
  formatCurrency,
  formatNumber,
  formatPercent,
  getChartColor,
  type ChartSeries
} from '@metorial/chart';
import type {
  DashboardInstanceAgentTrackingSpendBreakdownOutput,
  DashboardInstanceAgentTrackingSpendTimelineOutput
} from '@metorial/dashboard-sdk';
import { canonicalize } from '@lowerdeck/canonicalize';
import { renderWithLoader } from '@metorial/data-hooks';
import { getListFilterValue, useFilterState, type FilterPayload } from '@metorial/data-list';
import { Paths } from '@metorial/frontend-config';
import { MetricsSummary } from '@metorial/metrics-page';
import {
  useAgentTrackingSessions,
  useAgentTrackingSpendBreakdown,
  useAgentTrackingSpendTimeline
} from '@metorial/state';
import { Button, Flex, OptionToggle, Progress, Spacer, Text, theme } from '@metorial/ui';
import { Box, FilterToolbar, Table } from '@metorial/ui-product';
import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import styled from 'styled-components';
import { useInstanceContext } from '../../lib/dataList';
import { CostValue } from './cost';
import { describeCostComparison } from './costComparison';
import { dollarsOf, formatAmount, formatCost } from './costFormat';
import { AgentTrackingErrorState } from './errorState';
import { agentTrackingFilters } from './filters';
import { MemberIdentity } from './member';
import { hiddenGroupText, useAgentTrackingPrivacy } from './privacy';
import {
  formatAgentTrackingRange,
  useAgentTrackingRange,
  useSearchParamOption,
  type AgentTrackingRangePreset
} from './range';
import {
  formatRequests,
  ModelNameCell,
  SessionCost,
  SessionModels,
  SessionSummaryCell
} from './sessionParts';
import { costSplit, describeSpendChange, formatCount, hasUsage } from './spendSummary';

let DAY = 24 * 60 * 60 * 1000;

let expensiveSessionsLimit = 4;

let maxDayLabels = 14;

let billedColor = getChartColor('blue');

let estimatedColor = getChartColor('gray');

let microsPerDollar = 1_000_000;

let filterRangeText = 'this range';

let measures = [
  { id: 'cost', label: 'Cost', title: 'Cost Per Day', series: null, note: null },
  { id: 'tokens', label: 'Tokens', title: 'Tokens Per Day', series: null, note: null },
  {
    id: 'sessions',
    label: 'Sessions',
    title: 'Active Sessions Per Day',
    series: 'Active Sessions',
    note: 'A session active on several days counts on each of them.'
  },
  {
    id: 'members',
    label: 'Active Members',
    title: 'Active Members Per Day',
    series: 'Active Members',
    note: 'A member active on several days counts on each of them.'
  }
] as const;

let tokenKinds = [
  { id: 'input', name: 'Input', color: 'blue' },
  { id: 'output', name: 'Output', color: 'purple' },
  { id: 'cacheRead', name: 'Cache Read', color: 'cyan' },
  { id: 'cacheWrite', name: 'Cache Write', color: 'orange' },
  { id: 'reasoning', name: 'Reasoning', color: 'indigo' }
] as const;

let breakdownGroups = [
  { id: 'member', label: 'Member' },
  { id: 'model', label: 'Model' }
] as const;

let measureIds = measures.map(item => item.id);

let breakdownGroupIds = breakdownGroups.map(item => item.id);

type BreakdownGroup = (typeof breakdownGroups)[number]['id'];

type MeasureRow = (typeof measures)[number];

type CountMeasure = Extract<MeasureRow, { series: string }>;

type SpendFilters = { clientFamily?: string[]; modelId?: string[] };

type Timeline = DashboardInstanceAgentTrackingSpendTimelineOutput;

type SpendCost = Timeline['total']['cost'];

type BreakdownItem = DashboardInstanceAgentTrackingSpendBreakdownOutput['items'][number];

let SplitTrack = styled.div`
  display: flex;
  width: 100%;
  height: 10px;
  border-radius: 999px;
  overflow: hidden;
  background: ${theme.colors.gray300};
`;

let SplitPart = styled.span<{ $color: string; $share: number }>`
  width: ${({ $share }) => $share * 100}%;
  background: ${({ $color }) => $color};

  & + & {
    border-left: 2px solid ${theme.colors.background};
  }
`;

let Swatch = styled.span<{ $color: string }>`
  flex-shrink: 0;
  width: 10px;
  height: 10px;
  margin-top: 4px;
  border-radius: 3px;
  background: ${({ $color }) => $color};
`;

let Legend = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 12px 28px;
`;

let sessionsQuery = (range: AgentTrackingRangePreset, filters: SpendFilters) => {
  let query = new URLSearchParams({ range });
  if (filters.modelId) query.set('modelId', filters.modelId.join(','));
  if (filters.clientFamily) query.set('clientFamily', filters.clientFamily.join(','));

  return query.toString();
};

let noneIn = (what: string, filtered: unknown) =>
  `${what} in this range${filtered ? ' with these filters' : ''}.`;

let toDollars = (micros: number | null) =>
  micros === null ? null : Number(dollarsOf(micros));

let toMicros = (dollars: number) => Math.round(dollars * microsPerDollar);

let isZero = (micros: number | null) => (micros ?? 0) == 0;

let formatUnpricedRequests = (count: number) =>
  `${formatRequests(count)} without a known cost`;

let LegendItem = ({
  color,
  title,
  children
}: {
  color: string;
  title: string;
  children: React.ReactNode;
}) => (
  <Flex gap={10} align="start">
    <Swatch $color={color} />

    <Flex direction="column" gap={2}>
      <Text as="span" size="2" weight="strong">
        {title}
      </Text>
      <Text as="span" size="1" color="gray600">
        {children}
      </Text>
    </Flex>
  </Flex>
);

let CostSplit = ({ cost }: { cost: SpendCost }) => {
  let split = costSplit(cost);
  if (!split) return null;

  let share = (value: number) => formatPercent(value, { precision: 0 });

  return (
    <>
      <SplitTrack role="img" aria-label="Billed against estimated">
        {split.billedShare > 0 ? (
          <SplitPart $color={billedColor} $share={split.billedShare} />
        ) : null}
        {split.estimatedShare > 0 ? (
          <SplitPart $color={estimatedColor} $share={split.estimatedShare} />
        ) : null}
      </SplitTrack>

      <Spacer height={12} />

      <Legend>
        {!isZero(cost.billedMicros) ? (
          <LegendItem
            color={billedColor}
            title={`Billed ${formatAmount(cost.billedMicros!, { estimate: false })} · ${share(split.billedShare)}`}
          >
            From provider bills, such as API keys and Bedrock. Matches your provider's bill.
          </LegendItem>
        ) : null}

        {!isZero(cost.estimatedMicros) ? (
          <LegendItem
            color={estimatedColor}
            title={`Estimated ${formatCost(cost.estimatedMicros, { estimate: true })} · ${share(split.estimatedShare)}`}
          >
            Not a bill: usage no provider bill covers, such as what a Claude subscription or
            seat includes. Valued at your contract prices where set, else the cost Claude Code
            reports, else list prices. A tilde (~) always marks an estimate.
          </LegendItem>
        ) : null}
      </Legend>
    </>
  );
};

let barKey = (startsAt: Date) => new Date(new Date(startsAt).getTime() + DAY / 2);

let chartDomainEnd = (timeline: Timeline) => {
  let last = timeline.items[timeline.items.length - 1];
  return last ? new Date(new Date(last.startsAt).getTime() + DAY) : timeline.range.to;
};

let dayTickLabel = (timeline: Timeline) => {
  let format = new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    timeZone: timeline.range.timeZone
  });
  let step = Math.ceil(timeline.items.length / maxDayLabels);
  let last = timeline.items.length - 1;
  let days = timeline.items.map((item, i) => ({
    key: barKey(item.startsAt).getTime(),
    label: (last - i) % step == 0 ? format.format(new Date(item.startsAt)) : ''
  }));

  return (value: Date) =>
    days.find(day => Math.abs(day.key - value.getTime()) < DAY / 4)?.label ?? '';
};

// Half-day ticks fall on the bar centres, and only those are labelled.
let useDailyBars = (timeline: Timeline) =>
  useMemo(() => {
    let domain = { from: timeline.range.from, to: chartDomainEnd(timeline) };
    let span = new Date(domain.to).getTime() - new Date(domain.from).getTime();

    return {
      type: 'bar' as const,
      height: 220,
      xAxis: 'time' as const,
      intervalMs: DAY,
      domain,
      yMin: 0,
      xTickAmount: Math.max(2, Math.round(span / (DAY / 2))),
      xTickFormatter: dayTickLabel(timeline)
    };
  }, [timeline]);

let dailyEntries = (
  timeline: Timeline,
  value: (item: Timeline['items'][number]) => number | null
) => timeline.items.map(item => ({ key: barKey(item.startsAt), value: value(item) }));

let SpendChart = ({ timeline, filtered }: { timeline: Timeline; filtered: boolean }) => {
  let bars = useDailyBars(timeline);
  let hasBilled = timeline.items.some(item => !isZero(item.cost?.billedMicros ?? null));

  let allSeries: ChartSeries[] = [
    {
      id: 'billed',
      name: 'Billed',
      color: 'blue',
      entries: dailyEntries(timeline, item => toDollars(item.cost?.billedMicros ?? null))
    },
    {
      id: 'estimated',
      name: 'Estimated (~)',
      color: 'gray',
      entries: dailyEntries(timeline, item => toDollars(item.cost?.estimatedMicros ?? null))
    }
  ];

  return (
    <Chart
      {...bars}
      stacked
      legend={false}
      series={allSeries.filter(item => item.id != 'billed' || hasBilled)}
      valueFormatter={value => formatAmount(toMicros(value), { estimate: value != 0 })}
      seriesValueFormatter={(value, seriesIds) =>
        formatAmount(toMicros(value), {
          estimate: value != 0 && seriesIds.includes('estimated')
        })
      }
      tickFormatter={value => formatCurrency(value, { compact: true })}
      emptyText={noneIn('No cost', filtered)}
    />
  );
};

let CountChart = ({
  timeline,
  measure,
  filtered
}: {
  timeline: Timeline;
  measure: CountMeasure;
  filtered: boolean;
}) => {
  let bars = useDailyBars(timeline);

  return (
    <Chart
      {...bars}
      legend={false}
      series={[
        {
          id: measure.id,
          name: measure.series,
          color: 'blue',
          entries: dailyEntries(timeline, item => item.counts?.[measure.id] ?? null)
        }
      ]}
      valueFormatter={value => formatNumber(value)}
      tickFormatter={value =>
        Number.isInteger(value) ? formatNumber(value, { compact: true }) : ''
      }
      emptyText={noneIn(
        measure.id == 'sessions' ? 'No sessions' : 'No members active',
        filtered
      )}
    />
  );
};

let TokensChart = ({ timeline, filtered }: { timeline: Timeline; filtered: boolean }) => {
  let bars = useDailyBars(timeline);

  return (
    <Chart
      {...bars}
      stacked
      series={tokenKinds
        .filter(kind => kind.id != 'reasoning' || timeline.total.tokens.reasoning > 0)
        .map(kind => ({
          id: kind.id,
          name: kind.name,
          color: kind.color,
          entries: dailyEntries(timeline, item => item.tokens?.[kind.id] ?? null)
        }))}
      valueFormatter={value => formatNumber(value)}
      tickFormatter={value => formatNumber(value, { compact: true })}
      emptyText={noneIn('No tokens', filtered)}
    />
  );
};

let MeasureChart = ({
  timeline,
  measure,
  filtered
}: {
  timeline: Timeline;
  measure: MeasureRow;
  filtered: boolean;
}) => {
  if (measure.series) {
    return <CountChart timeline={timeline} measure={measure} filtered={filtered} />;
  }

  let BarChart = measure.id == 'tokens' ? TokensChart : SpendChart;
  return <BarChart timeline={timeline} filtered={filtered} />;
};

let OverTime = ({
  timeline,
  comparison,
  filtered
}: {
  timeline: Timeline;
  comparison: string | null;
  filtered: boolean;
}) => {
  let [measureId, setMeasure] = useSearchParamOption('measure', measureIds, 'cost');
  let measure = measures.find(item => item.id == measureId)!;
  let note = measure.id == 'cost' ? comparison : measure.note;

  return (
    <>
      <Flex justify="space-between" align="center" gap={12} wrap="wrap">
        <Text as="span" size="2" weight="strong">
          {measure.title}
        </Text>

        <div>
          <OptionToggle
            size="1"
            ariaLabel="Measure"
            items={measures.map(item => ({ id: item.id, label: item.label }))}
            value={measure.id}
            onChange={value => setMeasure(value as MeasureRow['id'])}
          />
        </div>
      </Flex>

      <Spacer height={12} />

      <MeasureChart timeline={timeline} measure={measure} filtered={filtered} />

      {note ? (
        <>
          <Spacer height={10} />

          <Text size="1" color="gray600">
            {note}
          </Text>
        </>
      ) : null}
    </>
  );
};

let SpendTotal = ({ timeline, filtered }: { timeline: Timeline; filtered: boolean }) => {
  let cost = timeline.total.cost;
  let requests = timeline.total.requests;
  let unpriced = cost.requestsWithoutCost;

  let hiddenItems = timeline.items.filter(item => item.hidden);
  let hiddenDays = hiddenItems.length;
  let hiddenDates =
    hiddenDays > 0 && hiddenDays <= 3
      ? ` (${hiddenItems
          .map(item =>
            new Date(item.startsAt).toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
              timeZone: timeline.range.timeZone
            })
          )
          .join(', ')})`
      : '';

  if (!hasUsage(timeline.total)) {
    return (
      <Box title="Total Spend" description={formatAgentTrackingRange(timeline.range)}>
        <Text size="2" color="gray600">
          {timeline.privacy.hiddenGroups
            ? `All usage in this range is on days with ${hiddenGroupText(timeline.privacy.minGroupUsers)}, so it is hidden.`
            : noneIn('No usage', filtered)}
        </Text>
      </Box>
    );
  }

  let change =
    !timeline.privacy.hiddenGroups && !timeline.previous.hiddenGroups
      ? describeSpendChange({
          current: cost.totalMicros,
          previous: timeline.previous.total.cost,
          preset: timeline.range.preset,
          startsBeforeRetention: timeline.previous.startsBeforeRetention,
          format: formatAmount
        })
      : null;

  let comparison = describeCostComparison({
    reportedByClientMicros: cost.reportedByClientMicros,
    listPriceMicros: cost.listPriceMicros,
    requests,
    requestsWithoutListPrice: cost.requestsWithoutListPrice,
    format: micros => formatAmount(micros, { estimate: true })
  });

  return (
    <Box title="Total Spend" description={formatAgentTrackingRange(timeline.range)}>
      <Flex justify="space-between" align="end" gap={20} wrap="wrap">
        <Flex direction="column" gap={4}>
          <Text as="span" size="8" weight="bold">
            <CostValue cost={cost} />
          </Text>

          {change ? (
            <Text as="span" size="2" color="gray700">
              {change.change ? (
                <Text as="span" size="2" weight="strong">
                  {change.change}
                </Text>
              ) : null}{' '}
              {change.text}
            </Text>
          ) : null}
        </Flex>

        <MetricsSummary
          columns={3}
          items={[
            { id: 'requests', label: 'Model Requests', value: formatNumber(requests) },
            {
              id: 'sessions',
              label: 'Sessions',
              value: timeline.counts
                ? formatCount(timeline.counts.sessions, timeline.counts.capped)
                : 'Hidden'
            },
            {
              id: 'members',
              label: 'Active Members',
              value: timeline.counts
                ? formatCount(timeline.counts.members, timeline.counts.capped)
                : 'Hidden'
            }
          ]}
        />
      </Flex>

      {timeline.privacy.hiddenGroups || !timeline.counts ? (
        <>
          <Spacer height={10} />

          <Text size="2" color="gray700">
            {[
              hiddenDays
                ? `${formatNumber(hiddenDays)} ${hiddenDays == 1 ? 'day is' : 'days are'} hidden${hiddenDates} because ${hiddenGroupText(timeline.privacy.minGroupUsers)} were active on ${hiddenDays == 1 ? 'it' : 'them'}. The total covers only the days shown.`
                : null,
              timeline.counts
                ? null
                : 'Sessions and Active Members are not shown, as distinct counts cannot be limited to the days shown.',
              timeline.previous.hiddenGroups && !timeline.privacy.hiddenGroups
                ? 'No comparison with the previous period, which has hidden days.'
                : null
            ]
              .filter(Boolean)
              .join(' ')}
          </Text>
        </>
      ) : null}

      {unpriced > 0 ? (
        <>
          <Spacer height={10} />

          <Text size="2" weight="medium" color="orange900">
            {cost.totalMicros === null
              ? `None of the ${formatNumber(requests)} requests has a known cost, so there is no total. That is not the same as zero.`
              : `${formatUnpricedRequests(unpriced)}. The total leaves them out, so the real cost may be higher.`}
          </Text>
        </>
      ) : null}

      <Spacer height={18} />

      <CostSplit cost={cost} />

      <Spacer height={18} />

      <OverTime timeline={timeline} comparison={comparison} filtered={filtered} />
    </Box>
  );
};

let othersLabel = (group: BreakdownGroup, others: number | null) => {
  if (group == 'model') return 'Other Models';
  return others ? `${formatNumber(others)} Others` : 'Everyone Else';
};

let BreakdownName = ({
  item,
  group,
  others
}: {
  item: BreakdownItem;
  group: BreakdownGroup;
  others: number | null;
}) => {
  if (group == 'member' && (item.kind == 'member' || item.kind == 'unknown')) {
    return <MemberIdentity member={item.member} />;
  }

  if (item.kind == 'other') {
    return (
      <Text as="span" size="2" weight="medium">
        {othersLabel(group, others)}
      </Text>
    );
  }

  return (
    <ModelNameCell model={item.model} unknownModelNames={item.unknownModelNames} detail />
  );
};

let BreakdownCost = ({ cost }: { cost: SpendCost }) => (
  <Flex direction="column" gap={2}>
    <CostValue cost={cost} />

    {cost.requestsWithoutCost > 0 ? (
      <Text as="span" size="1" color="orange900">
        {formatUnpricedRequests(cost.requestsWithoutCost)}
      </Text>
    ) : null}
  </Flex>
);

let Share = ({ share }: { share: number | null }) =>
  share === null ? (
    <Text as="span" size="2" color="gray600">
      —
    </Text>
  ) : (
    <Flex align="center" gap={10}>
      <Progress value={share} max={1} aria-label="Share" style={{ width: 72 }} />
      <Text as="span" size="2">
        {formatPercent(share)}
      </Text>
    </Flex>
  );

let Breakdown = ({
  instanceId,
  range,
  timeZone,
  filters,
  counts,
  ready
}: {
  instanceId: string;
  range: AgentTrackingRangePreset;
  timeZone: string;
  filters: SpendFilters;
  counts: Timeline['counts'] | undefined;
  ready: boolean;
}) => {
  let [group, setGroup] = useSearchParamOption('group', breakdownGroupIds, 'member');

  let breakdown = useAgentTrackingSpendBreakdown(
    instanceId,
    ready ? { groupBy: group, range, timeZone, ...filters } : null
  );

  return (
    <Box
      title="Cost By"
      description="The most expensive first. Share is of the total."
      rightActions={
        <OptionToggle
          size="2"
          ariaLabel="Cost By"
          items={breakdownGroups.map(item => ({ id: item.id, label: item.label }))}
          value={group}
          onChange={value => setGroup(value as BreakdownGroup)}
        />
      }
    >
      {renderWithLoader(
        { breakdown },
        {
          error: error => (
            <AgentTrackingErrorState
              key={canonicalize(breakdown.input)}
              error={error}
              onRetry={breakdown.refetch}
            />
          )
        }
      )(({ breakdown }) => {
        let items = breakdown.data.items;
        let listedMembers = items.filter(item => item.kind == 'member').length;
        let others =
          counts && !counts.capped && counts.members > listedMembers
            ? counts.members - listedMembers
            : null;

        return items.length ? (
          <Table
            headers={[group == 'member' ? 'Member' : 'Model', 'Requests', 'Cost', 'Share']}
            data={items.map(item => [
              <BreakdownName key="name" item={item} group={group} others={others} />,
              formatNumber(item.requests),
              <BreakdownCost key="cost" cost={item.cost} />,
              <Share key="share" share={item.share} />
            ])}
          />
        ) : (
          <Text size="2" color="gray600">
            {noneIn('No usage', filters.clientFamily || filters.modelId)}
          </Text>
        );
      })}
    </Box>
  );
};

let ExpensiveSessions = ({
  instanceId,
  range,
  timeZone,
  filters
}: {
  instanceId: string;
  range: AgentTrackingRangePreset;
  timeZone: string;
  filters: SpendFilters;
}) => {
  let ctx = useInstanceContext();
  let sessions = useAgentTrackingSessions(instanceId, {
    orderBy: 'cost',
    order: 'desc',
    range,
    timeZone,
    limit: expensiveSessionsLimit,
    ...filters
  });

  let params = [ctx.organization, ctx.project, ctx.instance] as const;
  let allSessionsPath = `${Paths.instance.agentTracking.sessions(...params)}?${sessionsQuery(range, filters)}`;

  return (
    <Box
      title="Most Expensive Sessions"
      description={
        filters.modelId
          ? 'Sessions last active in this period that used these models, ranked by the cost of the whole session.'
          : 'Sessions last active in this period, ranked by the cost of the whole session.'
      }
      rightActions={
        <Link to={allSessionsPath}>
          <Button size="2" variant="outline" as="span">
            All Sessions
          </Button>
        </Link>
      }
    >
      {renderWithLoader(
        { sessions },
        {
          error: error => (
            <AgentTrackingErrorState
              key={canonicalize(sessions.input)}
              error={error}
              onRetry={sessions.refetch}
            />
          )
        }
      )(({ sessions }) =>
        sessions.data.items.length ? (
          <Table
            headers={['Session', 'Member', 'Models', 'Cost']}
            data={sessions.data.items.map(session => ({
              href: Paths.instance.agentTracking.session(...params, session.id),
              data: [
                <SessionSummaryCell key="session" session={session} showStart />,
                <MemberIdentity key="member" member={session.member} showEmail={false} />,
                <SessionModels key="models" session={session} />,
                <SessionCost key="cost" session={session} />
              ]
            }))}
          />
        ) : (
          <Text size="2" color="gray600">
            {noneIn('No sessions', filters.clientFamily || filters.modelId)}
          </Text>
        )
      )}
    </Box>
  );
};

let listValue = (payload: FilterPayload | undefined) => {
  let value = getListFilterValue(payload);
  return value?.length ? value : undefined;
};

let useSpendFilters = (instanceId: string, range: AgentTrackingRangePreset) => {
  let filters = useMemo(
    () =>
      Object.values(
        agentTrackingFilters(instanceId, { range, rangeText: filterRangeText }, [
          'client',
          'model'
        ])
      ),
    [instanceId, range]
  );
  let { filterState, payload } = useFilterState({ filters });
  let selected: SpendFilters = {
    clientFamily: listValue(payload.clientFamily),
    modelId: listValue(payload.modelId)
  };

  return { filters, filterState, selected };
};

let SpendPage = ({
  instanceId,
  individualsHidden
}: {
  instanceId: string;
  individualsHidden: boolean;
}) => {
  let { range, setRange, presets, timeZone } = useAgentTrackingRange({ individualsHidden });
  let spendFilters = useSpendFilters(instanceId, range);
  let { filters, filterState } = spendFilters;
  let selected: SpendFilters = individualsHidden ? {} : spendFilters.selected;
  let timelineQuery = { range, timeZone, ...selected };
  let timeline = useAgentTrackingSpendTimeline(instanceId, timelineQuery);
  let filtered = !!(selected.clientFamily || selected.modelId);

  // Waits for the timeline: the service allows four concurrent queries.
  let timelineReady =
    !!timeline.data &&
    canonicalize(timeline.input) == canonicalize({ instanceId, ...timelineQuery });

  return (
    <Flex direction="column" gap={20}>
      <Flex direction="column" gap={12}>
        <Flex direction="column" gap={8}>
          <OptionToggle
            size="2"
            ariaLabel="Range"
            items={presets.map(preset => ({
              id: preset.id,
              label: preset.label
            }))}
            value={range}
            onChange={value => setRange(value as AgentTrackingRangePreset)}
          />

          <Text size="1" color="gray600">
            {individualsHidden
              ? 'Days are counted in UTC while individuals are hidden, and only whole days up to yesterday are shown.'
              : `Days are counted in ${timeZone}. New activity shows within a minute; its cost settles 30 to 90 seconds later.`}
          </Text>
        </Flex>

        {individualsHidden ? (
          <Text size="1" color="gray600">
            Filters are off while individuals are hidden: a total filtered to one model or
            client can single out the few people who use it.
          </Text>
        ) : (
          <FilterToolbar filters={filters} filterState={filterState} placeholder="Filter..." />
        )}
      </Flex>

      {renderWithLoader(
        { timeline },
        {
          error: error => (
            <AgentTrackingErrorState
              key={canonicalize(timeline.input)}
              error={error}
              onRetry={timeline.refetch}
            />
          )
        }
      )(({ timeline }) => (
        <SpendTotal timeline={timeline.data} filtered={filtered} />
      ))}

      {individualsHidden ? (
        <Text size="2" color="gray600">
          The breakdown by model is not available while individuals are hidden: on some days a
          model is used by too few people.
        </Text>
      ) : (
        <>
          <Breakdown
            instanceId={instanceId}
            range={range}
            timeZone={timeZone}
            filters={selected}
            counts={timeline.data?.counts}
            ready={timelineReady}
          />

          <ExpensiveSessions
            instanceId={instanceId}
            range={range}
            timeZone={timeZone}
            filters={selected}
          />
        </>
      )}
    </Flex>
  );
};

export let AgentTrackingSpend = ({ instanceId }: { instanceId: string }) => {
  let settings = useAgentTrackingPrivacy();

  return renderWithLoader(
    { settings },
    { error: error => <AgentTrackingErrorState error={error} onRetry={settings.refetch} /> }
  )(({ settings }) => (
    <SpendPage
      instanceId={instanceId}
      individualsHidden={settings.data.privacy.hideIndividuals}
    />
  ));
};
