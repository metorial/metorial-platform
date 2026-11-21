import { canonicalize } from '@lowerdeck/canonicalize';
import { formatNumber, formatPercent } from '@metorial/chart';
import type { DashboardInstanceAgentTrackingSessionsGetOutput } from '@metorial/dashboard-sdk';
import { renderWithLoader } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import { PageHeader } from '@metorial/layout';
import { MetricsSummary } from '@metorial/metrics-page';
import { useAgentTrackingSession } from '@metorial/state';
import { Button, Callout, Datalist, Flex, RenderDate, Text, theme } from '@metorial/ui';
import { Box, ID, Table } from '@metorial/ui-product';
import { useNow } from '@metorial/use-now';
import { Link } from 'react-router-dom';
import styled from 'styled-components';
import { useInstanceContext, type InstanceContext } from '../../lib/dataList';
import { formatSpan, formatTimeSpan, sessionLength, sessionTitle } from './activity';
import { CostValue } from './cost';
import { agentTrackingErrorStatus, AgentTrackingErrorState } from './errorState';
import { MemberDetails, memberPath } from './memberParts';
import { describeSessionCost, sessionCostKind } from './sessionCost';
import {
  clientLabel,
  clientVersion,
  costIsSettling,
  DetailColumns,
  formatRequests,
  ModelNameCell,
  SessionActivityLabel,
  settlingLabel
} from './sessionParts';

type Session = DashboardInstanceAgentTrackingSessionsGetOutput;

let tokenKinds = [
  { id: 'input', label: 'Input' },
  { id: 'output', label: 'Output' },
  { id: 'cacheRead', label: 'Cache Read' },
  { id: 'cacheWrite', label: 'Cache Write' },
  { id: 'reasoning', label: 'Reasoning' }
] as const;

let ModelList = styled.div`
  display: flex;
  flex-direction: column;

  & > * + * {
    border-top: 1px solid ${theme.colors.gray300};
  }
`;

let ModelRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: start;
  gap: 12px;
  padding: 10px 0;

  & > :first-child {
    min-width: 0;
  }
`;

let sessionsPath = (ctx: InstanceContext) =>
  Paths.instance.agentTracking.sessions(ctx.organization, ctx.project, ctx.instance);

let costBasisLabels: Record<ReturnType<typeof sessionCostKind>, string> = {
  unknown: 'No known cost',
  billed: 'Billed',
  partlyBilled: 'Partly billed, partly estimated',
  subscription: 'Estimated · covered by subscription',
  estimated: 'Estimated'
};

let SessionFigures = ({ session }: { session: Session }) => {
  let models = session.models.length + session.unknownModelNames.length;
  let cache = session.tokens.total ? session.tokens.cacheRead / session.tokens.total : null;

  return (
    <MetricsSummary
      columns={2}
      items={[
        {
          id: 'cost',
          label: 'Cost',
          value: costIsSettling(session) ? settlingLabel : <CostValue cost={session.cost} />,
          sub: session.summaryPending
            ? 'Still Settling'
            : costBasisLabels[sessionCostKind(session)]
        },
        {
          id: 'requests',
          label: 'Requests',
          value: formatNumber(session.requests),
          sub: models
            ? `To ${formatNumber(models)} ${models == 1 ? 'model' : 'models'}`
            : undefined
        },
        {
          id: 'tokens',
          label: 'Tokens',
          value: formatNumber(session.tokens.total, { compact: true }),
          sub: cache ? `${formatPercent(cache, { precision: 0 })} read from cache` : undefined
        },
        {
          id: 'length',
          label: 'Length',
          value: formatSpan(sessionLength(session)),
          sub: 'First to last activity'
        }
      ]}
    />
  );
};

let CostExplanation = ({ session }: { session: Session }) => {
  if (costIsSettling(session)) {
    return (
      <Callout color="gray">
        This session's cost is still settling. Cost, tokens and models arrive 30 to 90 seconds
        after activity.
      </Callout>
    );
  }

  let text = describeSessionCost({
    cost: session.cost,
    billingModes: session.billingModes,
    requests: session.requests,
    memberName: session.member?.name ?? null
  });
  if (!text) return null;

  return <Callout color={session.cost.isEstimate ? 'blue' : 'gray'}>{text}</Callout>;
};

let TokensBox = ({ session }: { session: Session }) => (
  <Box title="Tokens">
    <Table
      headers={['Kind', 'Tokens']}
      data={tokenKinds
        .filter(kind => kind.id != 'reasoning' || session.tokens.reasoning > 0)
        .map(kind => [kind.label, formatNumber(session.tokens[kind.id])])}
    />
  </Box>
);

let CostByModel = ({ session }: { session: Session }) => (
  <Box title="Cost by Model">
    {session.summaryPending && !session.usageByModel.length ? (
      <Text size="2" color="gray600">
        {settlingLabel} The cost per model arrives 30 to 90 seconds after activity.
      </Text>
    ) : session.usageByModel.length ? (
      <ModelList>
        {session.usageByModel.map(usage => (
          <ModelRow key={usage.key}>
            <Flex direction="column" gap={2}>
              <ModelNameCell model={usage.model} unknownModelNames={usage.unknownModelNames} />
              <Text as="span" size="1" color="gray600">
                {formatRequests(usage.requests)} ·{' '}
                {formatNumber(usage.tokens.total, { compact: true })} tokens
              </Text>
            </Flex>

            <Text as="span" size="2" weight="medium" wrap="nowrap">
              <CostValue cost={usage.cost} />
            </Text>
          </ModelRow>
        ))}
      </ModelList>
    ) : (
      <Text size="2" color="gray600">
        No model usage recorded.
      </Text>
    )}
  </Box>
);

let MemberBox = ({ session }: { session: Session }) => {
  let ctx = useInstanceContext();

  return (
    <Box title="Member">
      <MemberDetails
        member={session.member}
        href={session.member ? memberPath(ctx, session.member.id) : undefined}
      />
    </Box>
  );
};

let ClientBox = ({ session }: { session: Session }) => (
  <Box title="Client">
    <Datalist
      items={[
        { label: 'Client', value: clientLabel(session.client) },
        { label: 'Version', value: clientVersion(session.client) ?? '—' },
        { label: 'Surface', value: session.client.surface ?? '—' }
      ]}
    />
  </Box>
);

let SessionBox = ({ session }: { session: Session }) => (
  <Box title="Session">
    <Datalist
      items={[
        { label: 'Activity', value: <SessionActivityLabel session={session} /> },
        { label: 'Started', value: <RenderDate date={session.startedAt} /> },
        { label: 'Last Activity', value: <RenderDate date={session.lastActivityAt} /> },
        ...(session.endedAt
          ? [{ label: 'Ended', value: <RenderDate date={session.endedAt} /> }]
          : []),
        { label: 'Session ID', value: <ID id={session.id} /> }
      ]}
    />
  </Box>
);

let SessionHeader = ({ sessionId, session }: { sessionId: string; session?: Session }) => {
  let ctx = useInstanceContext();
  let now = useNow();

  let title = session ? sessionTitle(session, now) : 'Session';
  let path = Paths.instance.agentTracking.session(
    ctx.organization,
    ctx.project,
    ctx.instance,
    sessionId
  );

  let description = session
    ? [
        formatTimeSpan(session.startedAt, session.endedAt ?? session.lastActivityAt, now),
        [clientLabel(session.client), clientVersion(session.client)].filter(Boolean).join(' '),
        session.client.surface
      ]
        .filter(Boolean)
        .join(' · ')
    : undefined;

  return (
    <PageHeader
      title={title}
      description={description}
      pagination={[
        { label: 'Sessions', href: sessionsPath(ctx) },
        { label: title, href: path }
      ]}
    />
  );
};

let SessionDetail = ({ session }: { session: Session }) => (
  <Flex direction="column" gap={20}>
    <SessionHeader sessionId={session.id} session={session} />

    <DetailColumns>
      <Flex direction="column" gap={20}>
        <SessionFigures session={session} />
        <CostExplanation session={session} />
        <TokensBox session={session} />
      </Flex>

      <Flex direction="column" gap={20}>
        <CostByModel session={session} />
        <MemberBox session={session} />
        <ClientBox session={session} />
        <SessionBox session={session} />
      </Flex>
    </DetailColumns>
  </Flex>
);

let SessionNotFound = () => {
  let ctx = useInstanceContext();

  return (
    <Callout
      color="gray"
      action={
        <Link to={sessionsPath(ctx)}>
          <Button size="2" variant="outline" as="span">
            Back to Sessions
          </Button>
        </Link>
      }
    >
      There is no session with this ID in this instance. Check the link, or find the session in
      the list.
    </Callout>
  );
};

export let AgentTrackingSession = ({
  instanceId,
  sessionId
}: {
  instanceId: string;
  sessionId: string;
}) => {
  let session = useAgentTrackingSession(instanceId, sessionId);

  return renderWithLoader(
    { session },
    {
      error: error => (
        <Flex direction="column" gap={20}>
          <SessionHeader sessionId={sessionId} />

          {agentTrackingErrorStatus(error) == 404 ? (
            <SessionNotFound />
          ) : (
            <AgentTrackingErrorState
              key={canonicalize(session.input)}
              error={error}
              onRetry={session.refetch}
            />
          )}
        </Flex>
      )
    }
  )(({ session }) => <SessionDetail session={session.data} />);
};
