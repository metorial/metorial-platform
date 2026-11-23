import { canonicalize } from '@lowerdeck/canonicalize';
import { formatNumber, formatPercent, getChartColor } from '@metorial/chart';
import { MetricsSummary } from '@metorial/metrics-page';
import { Flex, Progress, Spacer, Text, theme } from '@metorial/ui';
import React from 'react';
import { useSearchParams } from 'react-router-dom';
import styled from 'styled-components';
import { CostValue } from './cost';
import { formatAmount, formatCost } from './costFormat';
import { MemberIdentity } from './memberParts';
import { unknownClientLabel } from './reportSummary';
import { clientLabel, formatRequests, ModelNameCell } from './sessionParts';
import { costSplit, formatCount } from './spendSummary';

let billedColor = getChartColor('blue');

let estimatedColor = getChartColor('gray');

type SpendCost = {
  totalMicros: number | null;
  billedMicros: number | null;
  estimatedMicros: number | null;
  isEstimate: boolean;
  requestsWithoutCost: number;
};

type SpendCounts = { sessions: number; members: number; capped: boolean } | null;

type BreakdownGroup = 'model' | 'client' | 'member';

type BreakdownRow = {
  kind: string;
  member: { id: string; name: string | null; email: string | null; matched: boolean } | null;
  model: { id: string; name: string | null } | null;
  client?: { family: string; name: string | null } | null;
  unknownModelNames: string[];
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
  margin-top: 4px;
  border-radius: 3px;
  background: ${({ $color }) => $color};
`;

let Legend = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 12px 28px;
`;

export let isZero = (micros: number | null) => (micros ?? 0) == 0;

export let formatUnpricedRequests = (count: number) =>
  `${formatRequests(count)} without a known cost`;

export let hiddenCountsNotice =
  'Sessions and Active Members are not shown, as distinct counts cannot be limited to the days shown.';

export let isLoadedFor = (loader: { input: unknown }, input: object | null) =>
  !!input && canonicalize(loader.input) == canonicalize(input);

export let breakdownOthersCount = (
  counts: SpendCounts | undefined,
  items: { kind: string }[]
) => {
  let listedMembers = items.filter(item => item.kind == 'member').length;

  return counts && !counts.capped && counts.members > listedMembers
    ? counts.members - listedMembers
    : null;
};

export let breakdownOthersLabel = (group: BreakdownGroup, others: number | null) => {
  if (group == 'model') return 'Other Models';
  if (group == 'client') return 'Other Clients';
  return others ? `${formatNumber(others)} Others` : 'Everyone Else';
};

// Shared by every caller, so a write builds on one not rendered yet, such as a growth rate
// committed on blur by the tap that caused the blur.
let latestSearch = { rendered: '', params: new URLSearchParams() };

export let useSearchParamWriter = () => {
  let [params, setParams] = useSearchParams();
  let rendered = params.toString();
  if (latestSearch.rendered != rendered) latestSearch = { rendered, params };

  let setParam = (name: string, value: string | undefined) => {
    let next = new URLSearchParams(latestSearch.params);
    if (value === undefined) next.delete(name);
    else next.set(name, value);

    latestSearch.params = next;
    setParams(next, { replace: true });
  };

  return [params, setParam] as const;
};

export let useSearchParamOption = <Id extends string>(
  name: string,
  ids: readonly Id[],
  defaultId: Id
) => {
  let [params, setParam] = useSearchParamWriter();
  let value = params.get(name);
  let current = ids.find(id => id == value) ?? defaultId;

  let setCurrent = (next: Id) => setParam(name, next == defaultId ? undefined : next);

  return [current, setCurrent] as const;
};

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

export let Share = ({ share }: { share: number | null }) =>
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

export let BreakdownName = ({
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
