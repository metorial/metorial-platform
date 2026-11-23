import { canonicalize } from '@lowerdeck/canonicalize';
import { formatNumber } from '@metorial/chart';
import { renderWithLoader, renderWithPagination } from '@metorial/data-hooks';
import {
  useAgentTrackingMemberInsights,
  useAgentTrackingSpendBreakdown
} from '@metorial/state';
import { Callout, Flex, Text, theme } from '@metorial/ui';
import { Table } from '@metorial/ui-product';
import { useNow } from '@metorial/use-now';
import { RiArrowDownLine, RiArrowUpDownLine, RiArrowUpLine } from '@remixicon/react';
import React, { useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { styled } from 'styled-components';
import { useInstanceContext } from '../../../lib/dataList';
import { formatDateTime } from '../activity';
import { CostValue } from '../cost';
import { formatAmount } from '../costFormat';
import { AgentTrackingErrorState } from '../errorState';
import { WithInfo } from '../info';
import { MemberIdentity, memberPath } from '../memberParts';
import { getBrowserTimeZone } from '../range';
import { modelLabel, Muted } from '../sessionParts';
import { BreakdownCost, BreakdownName, isZero, Share } from '../spendParts';
import {
  teamViewDefinitions,
  type TeamViewColumn,
  type TeamViewParams,
  type TeamViewState
} from './definitions';
import {
  describeInsightsSummary,
  describeMaxEffort,
  describeModelListSummary,
  formatInsightShare,
  modelCatalogNotice,
  notReportedLabel,
  outdatedModelStatusLabel,
  partOfCost,
  seatUsageNotice,
  truncatedNotice,
  type MemberInsight,
  type MemberInsights
} from './format';
import { patchTeamViewSearch, sortPatch, toInsightsQuery, type InsightsQuery } from './state';

let columnHints: Partial<Record<TeamViewColumn, string>> = {
  outdated: modelCatalogNotice,
  seatUsage: seatUsageNotice
};

let VisuallyHidden = styled.span`
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
`;

let Flagged = styled.span`
  display: inline-block;
  padding: 2px 8px;
  border-radius: 6px;
  background: ${theme.colors.orange300};
  font-weight: 600;
`;

let SortButton = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 0;
  border: none;
  background: none;
  font: inherit;
  color: inherit;
  text-align: left;
  white-space: nowrap;
  cursor: pointer;

  &:hover,
  &:focus-visible {
    color: ${theme.colors.foreground};
  }
`;

let Dash = ({ label }: { label: string }) => (
  <span title={label}>
    <span aria-hidden="true">
      <Muted>—</Muted>
    </span>
    <VisuallyHidden>{label}</VisuallyHidden>
  </span>
);

let NotReported = () => <Dash label={notReportedLabel} />;

let ShareValue = ({
  share,
  detail
}: {
  share: number | null | undefined;
  detail?: string | null;
}) => {
  let formatted = formatInsightShare(share);
  if (formatted === null) return <NotReported />;

  return (
    <WithInfo info={detail}>
      <Text as="span" size="2">
        {formatted}
      </Text>
    </WithInfo>
  );
};

let LastActive = ({ date }: { date: Date | null }) => {
  let now = useNow();
  return date ? (
    <span style={{ whiteSpace: 'nowrap' }}>{formatDateTime(date, now)}</span>
  ) : (
    <Dash label="No Activity" />
  );
};

let OutdatedModels = ({
  practices
}: {
  practices: NonNullable<MemberInsight['practices']>;
}) => {
  let formatted = formatInsightShare(practices.outdatedShare);
  if (formatted === null) return <NotReported />;

  return (
    <WithInfo
      info={
        practices.outdatedModels.length ? (
          <Flex direction="column" gap={2}>
            {practices.outdatedModels.map(outdated => (
              <span key={outdated.model.id}>
                {`${modelLabel(outdated.model)} · ${outdatedModelStatusLabel(outdated)}`}
              </span>
            ))}
          </Flex>
        ) : null
      }
    >
      <Text as="span" size="2">
        {formatted}
      </Text>
    </WithInfo>
  );
};

let SeatUsage = ({ seat }: { seat: NonNullable<MemberInsight['seat']> }) => {
  if (seat.listPriceMicros === null) return <Muted>No List Price</Muted>;

  return (
    <span>
      {formatAmount(seat.listPriceMicros, { estimate: !isZero(seat.listPriceMicros) })}
    </span>
  );
};

let InsightCell = ({ column, item }: { column: TeamViewColumn; item: MemberInsight }) => {
  let practices = item.practices;

  switch (column) {
    case 'rank':
      return <Muted>{formatNumber(item.rank)}</Muted>;
    case 'member':
      return <MemberIdentity member={item.member} />;
    case 'cost':
      return <BreakdownCost cost={item.cost} />;
    case 'share':
      return <Share share={item.share} label={formatInsightShare(item.share)} />;
    case 'sessions':
      return <span>{formatNumber(item.sessions)}</span>;
    case 'requests':
      return <span>{formatNumber(item.requests)}</span>;
    case 'lastActive':
      return <LastActive date={item.lastActivityAt} />;
    case 'modelCost':
      return <CostValue cost={partOfCost(item.models?.costMicros, item.cost)} />;
    case 'modelShare':
      return (
        <Share
          share={item.models?.costShare ?? null}
          label={formatInsightShare(item.models?.costShare)}
        />
      );
    case 'modelRequests':
      return <span>{formatNumber(item.models?.requests ?? 0)}</span>;
    case 'highEffort':
      return practices ? (
        <ShareValue
          share={practices.highEffortShare}
          detail={practices.maxEffortRequests ? describeMaxEffort(practices) : null}
        />
      ) : (
        <NotReported />
      );
    case 'fastMode':
      return <ShareValue share={practices?.fastShare} />;
    case 'outdated':
      return practices ? <OutdatedModels practices={practices} /> : <NotReported />;
    case 'cacheHitRate':
      return <ShareValue share={practices?.cacheHitRate} />;
    case 'seat':
      return item.seat?.seat ? <span>{item.seat.seat}</span> : <NotReported />;
    case 'plan':
      return item.seat?.plan ? <span>{item.seat.plan}</span> : <NotReported />;
    case 'seatUsage':
      return item.seat ? <SeatUsage seat={item.seat} /> : <NotReported />;
  }
};

let FlaggedCell = ({ children }: { children: React.ReactNode }) => (
  <Flagged title="Past its limit">
    {children}
    <VisuallyHidden>, past its limit</VisuallyHidden>
  </Flagged>
);

let SortHeader = ({
  view,
  column,
  onPatch
}: {
  view: TeamViewState;
  column: { id: TeamViewColumn; header: string; title?: string };
  onPatch: (patch: TeamViewParams) => void;
}) => {
  let sort = teamViewDefinitions[view.kind].sorts.find(item => item.column == column.id);
  if (!sort) {
    return (
      <span title={column.title} style={{ whiteSpace: 'nowrap' }}>
        {column.header}
      </span>
    );
  }

  let name = column.title ?? column.header;
  let hint = columnHints[column.id];
  let active = view.params.sort == sort.id;
  let ascending = view.params.order == 'asc';
  let Icon = !active ? RiArrowUpDownLine : ascending ? RiArrowUpLine : RiArrowDownLine;

  let button = (
    <SortButton
      type="button"
      title={`Sort by ${name}`}
      aria-label={active ? `${name}, sorted ${ascending ? 'ascending' : 'descending'}` : name}
      onClick={() => onPatch(sortPatch(view, sort.id))}
    >
      {column.header}
      <Icon size={12} color={active ? undefined : theme.colors.gray650} aria-hidden />
    </SortButton>
  );

  return <WithInfo info={hint}>{button}</WithInfo>;
};

let Summary = ({ view, insights }: { view: TeamViewState; insights: MemberInsights }) => (
  <>
    <Text size="2" color="gray800">
      {describeInsightsSummary(view.kind, insights.summary)}
    </Text>

    {insights.truncated ? (
      <Callout color="gray">{truncatedNotice(!!view.params.includeInactive)}</Callout>
    ) : null}
  </>
);

let emptyText = (view: TeamViewState) => {
  if (view.params.flaggedOnly) return 'Nobody meets a flag threshold in this range.';
  if (view.kind == 'by_model') return 'Nobody used the selected models in this range.';

  return 'Nobody sent usage in this range.';
};

let InsightsResults = ({
  instanceId,
  view,
  query,
  onPatch
}: {
  instanceId: string;
  view: TeamViewState;
  query: InsightsQuery;
  onPatch: (patch: TeamViewParams) => void;
}) => {
  let ctx = useInstanceContext();
  let insights = useAgentTrackingMemberInsights(instanceId, query);
  let overview = useRef<MemberInsights | null>(null);
  if (insights.data) overview.current = insights.data;

  let columns = teamViewDefinitions[view.kind].columns;

  let list = renderWithPagination(insights, {
    emptyState: <Muted>{emptyText(view)}</Muted>,
    hidePaginationWhenUnavailable: true,
    error: error => <AgentTrackingErrorState error={error} onRetry={insights.refetch} />
  })(({ data }) => (
    <Table
      headers={columns.map(column => (
        <SortHeader key={column.id} view={view} column={column} onPatch={onPatch} />
      ))}
      data={(data.items ?? []).map(item => {
        let flagged = new Set(item.flags);

        return {
          href: memberPath(ctx, item.member.id, view.params.range),
          data: columns.map(column =>
            column.flag && flagged.has(column.flag) ? (
              <FlaggedCell key={column.id}>
                <InsightCell column={column.id} item={item} />
              </FlaggedCell>
            ) : (
              <InsightCell key={column.id} column={column.id} item={item} />
            )
          )
        };
      })}
    />
  ));

  return (
    <Flex direction="column" gap={14} style={{ minWidth: 0 }}>
      {overview.current ? <Summary view={view} insights={overview.current} /> : null}

      {list}
    </Flex>
  );
};

let ModelList = ({ instanceId, view }: { instanceId: string; view: TeamViewState }) => {
  let [search] = useSearchParams();
  let breakdown = useAgentTrackingSpendBreakdown(instanceId, {
    groupBy: 'model',
    range: view.params.range,
    timeZone: getBrowserTimeZone()
  });

  return renderWithLoader(
    { breakdown },
    { error: error => <AgentTrackingErrorState error={error} onRetry={breakdown.refetch} /> }
  )(({ breakdown }) => (
    <Flex direction="column" gap={14} style={{ minWidth: 0 }}>
      <Text size="2" color="gray800">
        {describeModelListSummary(breakdown.data)}
      </Text>

      {breakdown.data.items.length ? (
        <Table
          headers={['Model', 'Requests', 'Cost', 'Share of Cost']}
          data={breakdown.data.items.map(item => ({
            href:
              item.kind == 'other'
                ? undefined
                : `?${patchTeamViewSearch(search, { modelIds: [item.model?.id ?? item.key] })}`,
            data: [
              <BreakdownName key="name" item={item} group="model" others={null} />,
              formatNumber(item.requests),
              <BreakdownCost key="cost" cost={item.cost} />,
              <Share key="share" share={item.share} label={formatInsightShare(item.share)} />
            ]
          }))}
        />
      ) : (
        <Muted>Nobody sent usage in this range.</Muted>
      )}
    </Flex>
  ));
};

export let TeamInsights = ({
  instanceId,
  view,
  onPatch
}: {
  instanceId: string;
  view: TeamViewState;
  onPatch: (patch: TeamViewParams) => void;
}) => {
  let query = toInsightsQuery(view, getBrowserTimeZone());

  if (!query) return <ModelList instanceId={instanceId} view={view} />;

  return (
    <InsightsResults
      key={canonicalize({ instanceId, query })}
      instanceId={instanceId}
      view={view}
      query={query}
      onPatch={onPatch}
    />
  );
};
