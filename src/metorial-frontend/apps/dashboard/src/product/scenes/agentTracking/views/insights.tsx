import { canonicalize } from '@lowerdeck/canonicalize';
import { formatNumber } from '@metorial/chart';
import { renderWithPagination } from '@metorial/data-hooks';
import { MetricsSummary } from '@metorial/metrics-page';
import { useAgentTrackingMemberInsights } from '@metorial/state';
import { Badge, Callout, Flex, Text } from '@metorial/ui';
import { Table } from '@metorial/ui-product';
import { useNow } from '@metorial/use-now';
import React, { useRef } from 'react';
import { useInstanceContext } from '../../../lib/dataList';
import { formatDateTime } from '../activity';
import { CostValue } from '../cost';
import { formatAmount, formatCost } from '../costFormat';
import { AgentTrackingErrorState } from '../errorState';
import { MemberIdentity, memberPath } from '../memberParts';
import { getBrowserTimeZone } from '../range';
import { modelLabel, Muted } from '../sessionParts';
import { BreakdownCost, isZero, Share } from '../spendParts';
import { teamViewDefinitions, type TeamViewColumn, type TeamViewState } from './definitions';
import {
  countsCappedNotice,
  describeFlagCount,
  describeMaxEffort,
  flagCountOf,
  formatInsightShare,
  hasNoReportedSeat,
  insightFlagLabels,
  modelCatalogNotice,
  noSeatReportedNotice,
  notReportedLabel,
  outdatedModelStatusLabel,
  partOfCost,
  requestRecordsClippedNotice,
  seatEstimateNotice,
  truncatedNotice,
  type InsightFlag,
  type MemberInsight,
  type MemberInsights
} from './format';
import { toInsightsQuery, type InsightsQuery } from './state';

let practiceSummaries = [
  { id: 'highEffort', label: 'High Effort', share: 'highEffortShare', flag: 'high_effort' },
  { id: 'fastMode', label: 'Fast Mode', share: 'fastShare', flag: 'fast_mode' },
  {
    id: 'outdated',
    label: 'Outdated Models',
    share: 'outdatedShare',
    flag: 'outdated_models'
  },
  {
    id: 'cacheHitRate',
    label: 'Cache Hit Rate',
    share: 'cacheHitRate',
    flag: 'low_cache_hit_rate'
  }
] as const;

let NotReported = () => <Muted>{notReportedLabel}</Muted>;

let Stacked = ({ main, detail }: { main: React.ReactNode; detail?: React.ReactNode }) => (
  <Flex direction="column" gap={2}>
    <Text as="span" size="2">
      {main}
    </Text>

    {detail ? (
      <Text as="span" size="1" color="gray600">
        {detail}
      </Text>
    ) : null}
  </Flex>
);

let ShareValue = ({
  share,
  detail
}: {
  share: number | null | undefined;
  detail?: string | null;
}) => {
  let formatted = formatInsightShare(share);
  return formatted === null ? <NotReported /> : <Stacked main={formatted} detail={detail} />;
};

let LastActive = ({ date }: { date: Date | null }) => {
  let now = useNow();
  return date ? <span>{formatDateTime(date, now)}</span> : <Muted>—</Muted>;
};

let Flags = ({ flags }: { flags: InsightFlag[] }) =>
  flags.length ? (
    <Flex gap={4} wrap="wrap">
      {flags.map(flag => (
        <Badge key={flag} size="1" color="orange">
          {insightFlagLabels[flag]}
        </Badge>
      ))}
    </Flex>
  ) : (
    <Muted>—</Muted>
  );

let OutdatedModels = ({
  practices
}: {
  practices: NonNullable<MemberInsight['practices']>;
}) => {
  let formatted = formatInsightShare(practices.outdatedShare);
  if (formatted === null) return <NotReported />;

  return (
    <Flex direction="column" gap={2}>
      <Text as="span" size="2">
        {formatted}
      </Text>

      {practices.outdatedModels.map(outdated => (
        <Text key={outdated.model.id} as="span" size="1" color="gray600" truncate>
          {`${modelLabel(outdated.model)} · ${outdatedModelStatusLabel(outdated)}`}
        </Text>
      ))}
    </Flex>
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
      return <Share share={item.share} />;
    case 'sessions':
      return <span>{formatNumber(item.sessions)}</span>;
    case 'requests':
      return <span>{formatNumber(item.requests)}</span>;
    case 'lastActive':
      return <LastActive date={item.lastActivityAt} />;
    case 'modelCost':
      return <CostValue cost={partOfCost(item.models?.costMicros, item.cost)} />;
    case 'modelShare':
      return <Share share={item.models?.costShare ?? null} />;
    case 'modelRequests':
      return <span>{formatNumber(item.models?.requests ?? 0)}</span>;
    case 'highEffort':
      return practices ? (
        <ShareValue share={practices.highEffortShare} detail={describeMaxEffort(practices)} />
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
    case 'flags':
      return <Flags flags={item.flags} />;
  }
};

let summaryShare = (share: number | null | undefined) =>
  formatInsightShare(share) ?? notReportedLabel;

let flagSub = (insights: MemberInsights, flag: InsightFlag, share: number | null) =>
  share === null
    ? undefined
    : (describeFlagCount(flagCountOf(insights.summary, flag), insights.summary.members) ??
      undefined);

let SummaryStrip = ({ view, insights }: { view: TeamViewState; insights: MemberInsights }) => {
  let { summary } = insights;

  if (view.kind == 'practices' && summary.practices) {
    let practices = summary.practices;

    return (
      <MetricsSummary
        columns={4}
        items={practiceSummaries.map(item => ({
          id: item.id,
          label: item.label,
          value: summaryShare(practices[item.share]),
          sub: flagSub(insights, item.flag, practices[item.share])
        }))}
      />
    );
  }

  if (view.kind == 'by_model' && summary.models) {
    return (
      <MetricsSummary
        columns={3}
        items={[
          {
            id: 'modelCost',
            label: 'Cost on Selected Models',
            value: <CostValue cost={partOfCost(summary.models.costMicros, summary.cost)} />
          },
          {
            id: 'modelShare',
            label: 'Share of All Cost',
            value: summaryShare(summary.models.costShare)
          },
          {
            id: 'flagged',
            label: 'Flagged Members',
            value: formatNumber(summary.flagCounts.modelShare ?? 0),
            sub: `of ${formatNumber(summary.members)} ranked`
          }
        ]}
      />
    );
  }

  if (view.kind == 'seats' && summary.seat) {
    return (
      <MetricsSummary
        columns={3}
        items={[
          {
            id: 'lowUsage',
            label: 'Low Usage',
            value: formatNumber(summary.flagCounts.lowUsageSeat ?? 0),
            sub: `of ${formatNumber(summary.members)} members`
          },
          {
            id: 'unknownSeat',
            label: 'Seat Not Reported',
            value: formatNumber(summary.seat.unknownSeatMembers),
            sub: `of ${formatNumber(summary.members)} members`
          },
          {
            id: 'listPrice',
            label: 'Usage at List Price',
            value:
              formatCost(summary.cost.listPriceMicros, {
                estimate: !isZero(summary.cost.listPriceMicros)
              }) ?? notReportedLabel
          }
        ]}
      />
    );
  }

  return (
    <MetricsSummary
      columns={4}
      items={[
        { id: 'cost', label: 'Cost', value: <CostValue cost={summary.cost} /> },
        {
          id: 'members',
          label: 'Active Members',
          value: formatNumber(summary.activeMembers)
        },
        {
          id: 'sessions',
          label: 'Sessions With Usage',
          value: formatNumber(summary.sessions)
        },
        { id: 'requests', label: 'Requests', value: formatNumber(summary.requests) }
      ]}
    />
  );
};

let Notices = ({ view, insights }: { view: TeamViewState; insights: MemberInsights }) => {
  let { summary } = insights;
  let unattributed = summary.unattributedCostMicros;
  let notes = [
    summary.countsCapped ? countsCappedNotice : null,
    unattributed !== null && unattributed > 0
      ? `${formatAmount(unattributed, { estimate: summary.cost.isEstimate })} of the cost in this range has no member, such as API key or Bedrock usage. It counts toward each share but is not listed.`
      : null,
    view.kind == 'practices' ? modelCatalogNotice : null
  ].filter((note): note is string => !!note);

  return (
    <>
      {view.kind == 'seats' ? <Callout color="gray">{seatEstimateNotice}</Callout> : null}

      {view.kind == 'seats' && hasNoReportedSeat(summary) ? (
        <Callout color="blue">{noSeatReportedNotice}</Callout>
      ) : null}

      {insights.truncated ? (
        <Callout color="gray">{truncatedNotice(!!view.params.includeInactive)}</Callout>
      ) : null}

      {summary.requestRecordsClipped && (view.kind == 'practices' || view.kind == 'seats') ? (
        <Callout color="gray">{requestRecordsClippedNotice}</Callout>
      ) : null}

      {notes.map(note => (
        <Text key={note} size="1" color="gray600">
          {note}
        </Text>
      ))}
    </>
  );
};

let emptyText = (view: TeamViewState) => {
  if (view.params.flaggedOnly) return 'Nobody meets a flag threshold in this range.';
  if (view.kind == 'by_model') return 'Nobody used the selected models in this range.';

  return 'Nobody sent usage in this range.';
};

let InsightsResults = ({
  instanceId,
  view,
  query
}: {
  instanceId: string;
  view: TeamViewState;
  query: InsightsQuery;
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
      headers={columns.map(column => column.header)}
      data={(data.items ?? []).map(item => ({
        href: memberPath(ctx, item.member.id, view.params.range),
        data: columns.map(column => (
          <InsightCell key={column.id} column={column.id} item={item} />
        ))
      }))}
    />
  ));

  return (
    <Flex direction="column" gap={14}>
      {overview.current ? (
        <>
          <SummaryStrip view={view} insights={overview.current} />
          <Notices view={view} insights={overview.current} />
        </>
      ) : null}

      {list}
    </Flex>
  );
};

let ChooseModels = () => (
  <Callout color="gray">
    Choose one or more models above to see who uses them, and how much of each member's cost
    goes to them.
  </Callout>
);

export let TeamInsights = ({
  instanceId,
  view
}: {
  instanceId: string;
  view: TeamViewState;
}) => {
  let query = toInsightsQuery(view, getBrowserTimeZone());

  if (!query) return <ChooseModels />;

  return (
    <InsightsResults
      key={canonicalize({ instanceId, query })}
      instanceId={instanceId}
      view={view}
      query={query}
    />
  );
};
