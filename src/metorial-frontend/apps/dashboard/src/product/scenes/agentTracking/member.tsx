import { canonicalize } from '@lowerdeck/canonicalize';
import { formatNumber } from '@metorial/chart';
import type { DashboardInstanceAgentTrackingMembersListOutput } from '@metorial/dashboard-sdk';
import { PaginationSearchParamsProvider, renderWithLoader } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import { PageHeader } from '@metorial/layout';
import { MetricsSummary } from '@metorial/metrics-page';
import { useAgentTrackingMembers } from '@metorial/state';
import { Callout, Flex } from '@metorial/ui';
import { Box } from '@metorial/ui-product';
import { useNow } from '@metorial/use-now';
import { useInstanceContext } from '../../lib/dataList';
import { formatDateTime } from './activity';
import { CostValue } from './cost';
import { AgentTrackingErrorState } from './errorState';
import { lastActivePhrase, MemberDetails, memberName, memberPath } from './memberParts';
import { useLastActiveRange, withQuery } from './range';
import { DetailColumns } from './sessionParts';
import { AgentTrackingSessionsTable } from './sessions';

type Member = DashboardInstanceAgentTrackingMembersListOutput['items'][number];

let noCost = { totalMicros: 0, isEstimate: false };

let MemberHeader = ({ memberId, member }: { memberId: string; member?: Member }) => {
  let ctx = useInstanceContext();
  let { range } = useLastActiveRange();
  let title = member ? memberName(member) : 'Member';
  let teamPath = Paths.instance.agentTracking.team(
    ctx.organization,
    ctx.project,
    ctx.instance
  );

  return (
    <PageHeader
      title={title}
      description={member?.name ? (member.email ?? undefined) : undefined}
      pagination={[
        { label: 'Team', href: withQuery(teamPath, { range }) },
        { label: title, href: memberPath(ctx, memberId, range) }
      ]}
    />
  );
};

let MemberFigures = ({ member }: { member: Member | null }) => {
  let { range } = useLastActiveRange();
  let now = useNow();
  let phrase = lastActivePhrase(range);
  let sub = `${phrase[0]!.toUpperCase()}${phrase.slice(1)}`;

  return (
    <MetricsSummary
      columns={3}
      items={[
        {
          id: 'cost',
          label: 'Cost',
          value: <CostValue cost={member?.cost ?? noCost} />,
          sub
        },
        {
          id: 'sessions',
          label: 'Sessions',
          value: formatNumber(member?.sessions ?? 0),
          sub
        },
        {
          id: 'lastActive',
          label: 'Last Active',
          value: member ? formatDateTime(member.lastSeenAt, now) : '—',
          sub: member ? sub : `None ${phrase}`
        }
      ]}
    />
  );
};

let MemberSummary = ({
  memberId,
  inRange,
  identity
}: {
  memberId: string;
  inRange: Member | null;
  identity: Member;
}) => (
  <>
    <MemberHeader memberId={memberId} member={identity} />

    <DetailColumns>
      <MemberFigures member={inRange} />

      <Box title="Member">
        <MemberDetails member={identity} />
      </Box>
    </DetailColumns>
  </>
);

let MemberNotFound = ({ memberId }: { memberId: string }) => (
  <>
    <MemberHeader memberId={memberId} />

    <Callout color="gray">
      Nobody with this ID has sent usage to this instance. Check the link, or find the person
      on the Team tab.
    </Callout>
  </>
);

let MemberOverview = ({ instanceId, memberId }: { instanceId: string; memberId: string }) => {
  let { range, timeZone } = useLastActiveRange();
  let inRange = useAgentTrackingMembers(instanceId, { memberId, range, timeZone, limit: 1 });
  let needsIdentity = !!range && inRange.data?.items.length === 0;
  let anyTime = useAgentTrackingMembers(
    instanceId,
    needsIdentity ? { memberId, limit: 1 } : null
  );

  let errorState = (error: unknown, retry: () => void) => (
    <>
      <MemberHeader memberId={memberId} />
      <AgentTrackingErrorState
        key={canonicalize({ memberId, range })}
        error={error}
        onRetry={retry}
      />
    </>
  );

  return renderWithLoader(
    { inRange },
    { error: error => errorState(error, inRange.refetch) }
  )(({ inRange }) => {
    let member = inRange.data.items[0] ?? null;
    if (member)
      return <MemberSummary memberId={memberId} inRange={member} identity={member} />;
    if (!needsIdentity) return <MemberNotFound memberId={memberId} />;

    return renderWithLoader(
      { anyTime },
      { error: error => errorState(error, anyTime.refetch) }
    )(({ anyTime }) => {
      let identity = anyTime.data.items[0];

      return identity ? (
        <MemberSummary memberId={memberId} inRange={null} identity={identity} />
      ) : (
        <MemberNotFound memberId={memberId} />
      );
    });
  });
};

export let AgentTrackingMember = ({
  instanceId,
  memberId
}: {
  instanceId: string;
  memberId: string;
}) => (
  <Flex direction="column" gap={20}>
    <MemberOverview instanceId={instanceId} memberId={memberId} />

    <PaginationSearchParamsProvider enabled={true}>
      <AgentTrackingSessionsTable instanceId={instanceId} memberId={memberId} />
    </PaginationSearchParamsProvider>
  </Flex>
);
