import {
  formatCurrency,
  formatNumber,
  formatPercent,
  getChartColor,
  type ChartSeries,
  type ChartTime
} from '@metorial/chart';
import { MetricsSummary } from '@metorial/metrics-page';
import { Flex, Progress, Spacer, Text, theme } from '@metorial/ui';
import { Table } from '@metorial/ui-product';
import React from 'react';
import styled from 'styled-components';
import { CostValue } from './cost';
import { formatAmount, formatCost, toDollars, toMicros } from './costFormat';
import { WithInfo } from './info';
import { MemberIdentity } from './memberParts';
import { ModelNameCell } from './sessionParts';
import {
  breakdownOthersLabel,
  clientLabel,
  costSplit,
  formatCount,
  formatUnpricedRequests,
  isZero,
  unknownClientLabel,
  type BreakdownGroup
} from './spendSummary';

let billedColor = getChartColor('blue');

let estimatedColor = getChartColor('gray');

let breakdownNameHeaders: Record<BreakdownGroup, string> = {
  model: 'Model',
  client: 'Client',
  member: 'Member'
};

let estimateSeriesIds = ['estimated', 'projected'];

type SpendCost = {
  totalMicros: number | null;
  billedMicros: number | null;
  estimatedMicros: number | null;
  isEstimate: boolean;
  requestsWithoutCost: number;
};

type SpendCounts = { sessions: number; members: number; capped: boolean } | null;

type BreakdownRow = {
  kind: string;
  member: { id: string; name: string | null; email: string | null; matched: boolean } | null;
  model: { id: string; name: string | null } | null;
  client?: { family: string; name: string | null } | null;
  unknownModelNames: string[];
};

type BreakdownItem = BreakdownRow & {
  requests: number;
  share: number | null;
  cost: SpendCost;
};

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
  border-radius: 3px;
  background: ${({ $color }) => $color};
`;

let Legend = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 12px 28px;
`;

let LegendItem = ({
  color,
  title,
  children
}: {
  color: string;
  title: string;
  children: React.ReactNode;
}) => (
  <Flex gap={10} align="center">
    <Swatch $color={color} />

    <WithInfo info={children}>
      <Text as="span" size="2" weight="strong">
        {title}
      </Text>
    </WithInfo>
  </Flex>
);

export let CostSplit = ({ cost }: { cost: SpendCost }) => {
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
            From provider bills, such as API keys and Bedrock.
          </LegendItem>
        ) : null}

        {!isZero(cost.estimatedMicros) ? (
          <LegendItem
            color={estimatedColor}
            title={`Estimated ${formatCost(cost.estimatedMicros, { estimate: true })} · ${share(split.estimatedShare)}`}
          >
            Usage no provider bill covers, such as a Claude subscription, valued at your
            contract prices where set, else at the cost Claude Code reports or list prices.
          </LegendItem>
        ) : null}
      </Legend>
    </>
  );
};

export let BreakdownCost = ({ cost }: { cost: SpendCost }) => (
  <Flex direction="column" gap={2}>
    <CostValue cost={cost} />

    {cost.requestsWithoutCost > 0 ? (
      <Text as="span" size="1" color="orange900">
        {formatUnpricedRequests(cost.requestsWithoutCost)}
      </Text>
    ) : null}
  </Flex>
);

export let Share = ({ share, label }: { share: number | null; label?: string | null }) =>
  share === null ? (
    <Text as="span" size="2" color="gray600">
      —
    </Text>
  ) : (
    <Flex align="center" gap={10}>
      <Progress value={share} max={1} aria-label="Share" style={{ width: 72 }} />
      <Text as="span" size="2">
        {label ?? formatPercent(share)}
      </Text>
    </Flex>
  );

let BreakdownName = ({
  item,
  group,
  others
}: {
  item: BreakdownRow;
  group: BreakdownGroup;
  others: number | null;
}) => {
  if (item.kind == 'other') {
    return (
      <Text as="span" size="2" weight="medium">
        {breakdownOthersLabel(group, others)}
      </Text>
    );
  }

  if (group == 'member') return <MemberIdentity member={item.member} />;

  if (group == 'client') {
    return (
      <Text as="span" size="2" weight="medium" color={item.client ? undefined : 'gray600'}>
        {item.client ? clientLabel(item.client) : unknownClientLabel}
      </Text>
    );
  }

  return (
    <ModelNameCell model={item.model} unknownModelNames={item.unknownModelNames} detail />
  );
};

export let BreakdownTable = <Item extends BreakdownItem>({
  items,
  group,
  others,
  shareHeader = 'Share',
  shareLabel,
  href
}: {
  items: Item[];
  group: BreakdownGroup;
  others: number | null;
  shareHeader?: string;
  shareLabel?: (share: number | null) => string | null;
  href?: (item: Item) => string | undefined;
}) => (
  <Table
    headers={[breakdownNameHeaders[group], 'Requests', 'Cost', shareHeader]}
    data={items.map(item => ({
      href: href?.(item),
      data: [
        <BreakdownName key="name" item={item} group={group} others={others} />,
        formatNumber(item.requests),
        <BreakdownCost key="cost" cost={item.cost} />,
        <Share key="share" share={item.share} label={shareLabel?.(item.share)} />
      ]
    }))}
  />
);

export let costChartProps = <Row,>(d: {
  rows: Row[];
  key: (row: Row) => ChartTime;
  billed: (row: Row) => number | null;
  estimated: (row: Row) => number | null;
  projected?: (row: Row) => number | null;
}) => {
  let entries = (micros: (row: Row) => number | null) =>
    d.rows.map(row => ({ key: d.key(row), value: toDollars(micros(row)) }));
  let hasBilled = d.rows.some(row => !isZero(d.billed(row)));

  let series: ChartSeries[] = [
    ...(hasBilled
      ? [{ id: 'billed', name: 'Billed', color: 'blue' as const, entries: entries(d.billed) }]
      : []),
    { id: 'estimated', name: 'Estimated (~)', color: 'gray', entries: entries(d.estimated) },
    ...(d.projected
      ? [
          {
            id: 'projected',
            name: 'Projected (~)',
            color: 'violet' as const,
            entries: entries(d.projected)
          }
        ]
      : [])
  ];

  return {
    series,
    valueFormatter: (value: number) => formatAmount(toMicros(value), { estimate: false }),
    seriesValueFormatter: (value: number, seriesIds: string[]) =>
      formatAmount(toMicros(value), {
        estimate: value != 0 && seriesIds.some(id => estimateSeriesIds.includes(id))
      }),
    tickFormatter: (value: number) => formatCurrency(value, { compact: true })
  };
};

export let SpendCountsSummary = ({
  requests,
  counts
}: {
  requests: number;
  counts: SpendCounts;
}) => (
  <MetricsSummary
    columns={3}
    items={[
      { id: 'requests', label: 'Model Requests', value: formatNumber(requests) },
      {
        id: 'sessions',
        label: 'Sessions',
        value: counts ? formatCount(counts.sessions, counts.capped) : 'Hidden'
      },
      {
        id: 'members',
        label: 'Active Members',
        value: counts ? formatCount(counts.members, counts.capped) : 'Hidden'
      }
    ]}
  />
);

export let UnpricedNotice = ({ cost, requests }: { cost: SpendCost; requests: number }) =>
  cost.requestsWithoutCost > 0 ? (
    <>
      <Spacer height={10} />

      <Text size="2" weight="medium" color="orange900">
        {cost.totalMicros === null
          ? `None of the ${formatNumber(requests)} requests has a known cost, so there is no total. That is not the same as zero.`
          : `${formatUnpricedRequests(cost.requestsWithoutCost)}. The total leaves them out, so the real cost may be higher.`}
      </Text>
    </>
  ) : null;
