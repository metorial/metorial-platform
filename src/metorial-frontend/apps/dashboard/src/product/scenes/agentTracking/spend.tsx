import { Chart, formatCurrency, formatNumber, type ChartSeries } from '@metorial/chart';
import type { DashboardInstanceAgentTrackingSpendTimelineOutput } from '@metorial/dashboard-sdk';
import { canonicalize } from '@lowerdeck/canonicalize';
import { renderWithLoader } from '@metorial/data-hooks';
import { getListFilterValue, useFilterState, type FilterPayload } from '@metorial/data-list';
import { Paths } from '@metorial/frontend-config';
import {
  useAgentTrackingSessions,
  useAgentTrackingSpendBreakdown,
  useAgentTrackingSpendTimeline
} from '@metorial/state';
import { Button, Flex, OptionToggle, Spacer, Text } from '@metorial/ui';
import { Box, FilterToolbar, Table } from '@metorial/ui-product';
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useInstanceContext } from '../../lib/dataList';
import { CostValue } from './cost';
import { describeCostComparison } from './costComparison';
import { formatAmount, toDollars, toMicros } from './costFormat';
import { AgentTrackingErrorState } from './errorState';
import { AgentTrackingFilterRangeContext, agentTrackingFilters } from './filters';
import { MemberIdentity } from './memberParts';
import { useAgentTrackingPrivacy } from './privacy';
import {
  defaultAgentTrackingRange,
  formatAgentTrackingRange,
  getBrowserTimeZone,
  hiddenIndividualsSpendRangeFilter,
  spendRangeFilter,
  withQuery,
  type AgentTrackingRangePreset
} from './range';
import { SessionCost, SessionModels, SessionSummaryCell } from './sessionParts';
import {
  BreakdownCost,
  BreakdownName,
  breakdownOthersCount,
  CostSplit,
  hiddenCountsNotice,
  isLoadedFor,
  isZero,
  Share,
  SpendCountsSummary,
  UnpricedNotice,
  useSearchParamOption
} from './spendParts';
import { describeSpendChange, hasUsage, hiddenGroupText } from './spendSummary';

let DAY = 24 * 60 * 60 * 1000;

let expensiveSessionsLimit = 4;

let maxDayLabels = 14;

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

let noneIn = (what: string, filtered: unknown) =>
  `${what} in this range${filtered ? ' with these filters' : ''}.`;

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
      valueFormatter={value => formatAmount(toMicros(value), { estimate: false })}
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

let rangeDescription = (range: Timeline['range']) =>
  `${formatAgentTrackingRange(range)} · ${range.timeZone}`;

let SpendTotal = ({ timeline, filtered }: { timeline: Timeline; filtered: boolean }) => {
  let cost = timeline.total.cost;
  let requests = timeline.total.requests;

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
      <Box title="Total Spend" description={rangeDescription(timeline.range)}>
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
    <Box title="Total Spend" description={rangeDescription(timeline.range)}>
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

        <SpendCountsSummary requests={requests} counts={timeline.counts} />
      </Flex>

      {timeline.privacy.hiddenGroups || !timeline.counts ? (
        <>
          <Spacer height={10} />

          <Text size="2" color="gray700">
            {[
              hiddenDays
                ? `${formatNumber(hiddenDays)} ${hiddenDays == 1 ? 'day is' : 'days are'} hidden${hiddenDates} because ${hiddenGroupText(timeline.privacy.minGroupUsers)} were active on ${hiddenDays == 1 ? 'it' : 'them'}. The total covers only the days shown.`
                : null,
              timeline.counts ? null : hiddenCountsNotice,
              timeline.previous.hiddenGroups && !timeline.privacy.hiddenGroups
                ? 'No comparison with the previous period, which has hidden days.'
                : null
            ]
              .filter(Boolean)
              .join(' ')}
          </Text>
        </>
      ) : null}

      <UnpricedNotice cost={cost} requests={requests} />

      <Spacer height={18} />

      <CostSplit cost={cost} />

      <Spacer height={18} />

      <OverTime timeline={timeline} comparison={comparison} filtered={filtered} />
    </Box>
  );
};

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
      description="Share is of the total."
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
        let others = breakdownOthersCount(counts, items);

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
  let allSessionsPath = withQuery(Paths.instance.agentTracking.sessions(...params), {
    range,
    modelId: filters.modelId,
    clientFamily: filters.clientFamily
  });

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

let useSpendFilters = (instanceId: string, individualsHidden: boolean) => {
  let rangeFilter = individualsHidden ? hiddenIndividualsSpendRangeFilter : spendRangeFilter;
  let filters = useMemo(() => {
    if (individualsHidden) return [rangeFilter.filter];

    return [
      agentTrackingFilters.client(instanceId, filterRangeText),
      agentTrackingFilters.model(instanceId, filterRangeText),
      rangeFilter.filter
    ];
  }, [instanceId, individualsHidden, rangeFilter]);

  let { filterState, payload } = useFilterState({ filters });
  let selected: SpendFilters = individualsHidden
    ? {}
    : { clientFamily: listValue(payload.clientFamily), modelId: listValue(payload.modelId) };

  return {
    filters,
    filterState,
    selected,
    range: rangeFilter.parse(payload.range)?.[0] ?? defaultAgentTrackingRange
  };
};

let SpendPage = ({
  instanceId,
  individualsHidden
}: {
  instanceId: string;
  individualsHidden: boolean;
}) => {
  let { filters, filterState, selected, range } = useSpendFilters(
    instanceId,
    individualsHidden
  );
  let timeZone = individualsHidden ? 'UTC' : getBrowserTimeZone();
  let timelineQuery = { range, timeZone, ...selected };
  let timeline = useAgentTrackingSpendTimeline(instanceId, timelineQuery);
  let filtered = !!(selected.clientFamily || selected.modelId);

  // Waits for the timeline: the service allows four concurrent queries.
  let timelineReady =
    !!timeline.data && isLoadedFor(timeline, { instanceId, ...timelineQuery });

  return (
    <Flex direction="column" gap={20}>
      <Flex direction="column" gap={8}>
        <AgentTrackingFilterRangeContext.Provider value={range}>
          <FilterToolbar filters={filters} filterState={filterState} placeholder="Filter..." />
        </AgentTrackingFilterRangeContext.Provider>

        {individualsHidden ? (
          <Text size="1" color="gray600">
            Filters, Cost By and Most Expensive Sessions are off while individuals are hidden.
          </Text>
        ) : null}
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

      {individualsHidden ? null : (
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
