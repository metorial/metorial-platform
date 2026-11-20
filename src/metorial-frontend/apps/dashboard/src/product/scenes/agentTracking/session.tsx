import { canonicalize } from '@lowerdeck/canonicalize';
import { formatNumber, formatPercent } from '@metorial/chart';
import type { DashboardInstanceAgentTrackingSessionsGetOutput } from '@metorial/dashboard-sdk';
import { renderWithLoader } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import { PageHeader } from '@metorial/layout';
import { MetricsSummary } from '@metorial/metrics-page';
import { useAgentTrackingSession } from '@metorial/state';
import {
  Badge,
  Button,
  Callout,
  Datalist,
  Flex,
  RenderDate,
  Spacer,
  Text,
  theme,
  useCopy
} from '@metorial/ui';
import { Box, ID, Table } from '@metorial/ui-product';
import { useNow } from '@metorial/use-now';
import { RiFileCopyLine } from '@remixicon/react';
import { Link } from 'react-router-dom';
import styled from 'styled-components';
import { useInstanceContext, type InstanceContext } from '../../lib/dataList';
import { formatSpan, formatTimeSpan, sessionLength } from './activity';
import { CostValue } from './cost';
import { agentTrackingErrorStatus, AgentTrackingErrorState } from './errorState';
import { MemberIdentity, memberName, NotLinkedBadge } from './member';
import { describeSessionCost, firstName, sessionCostKind } from './sessionCost';
import { memberSessionsPath } from './sessions';
import {
  clientLabel,
  clientVersion,
  costIsSettling,
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

let Columns = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 2fr) minmax(280px, 1fr);
  gap: 20px;
  align-items: start;

  @media (max-width: 1000px) {
    grid-template-columns: minmax(0, 1fr);
  }
`;

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

let cacheShare = (session: Session) =>
  session.tokens.total ? session.tokens.cacheRead / session.tokens.total : null;

let SessionFigures = ({ session }: { session: Session }) => {
  let models = session.models.length + session.unknownModelNames.length;
  let cache = cacheShare(session);

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
  <Box title="Tokens" description="By kind, for the whole session.">
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
            <ModelNameCell model={usage.model} unknownModelNames={usage.unknownModelNames} />

            <Flex direction="column" align="end" gap={2}>
              <Text as="span" size="2" weight="medium">
                <CostValue cost={usage.cost} />
              </Text>
              <Text as="span" size="1" color="gray600">
                {formatRequests(usage.requests)} ·{' '}
                {formatNumber(usage.tokens.total, { compact: true })} tokens
              </Text>
            </Flex>
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

let MemberBox = ({ session }: { session: Session }) => (
  <Box title="Member">
    <Flex justify="space-between" align="center" gap={10}>
      <MemberIdentity member={session.member} showLink={false} />

      {session.member ? (
        session.member.matched ? (
          <Badge size="1" color="green" style={{ flexShrink: 0 }}>
            Linked
          </Badge>
        ) : (
          <NotLinkedBadge />
        )
      ) : null}
    </Flex>

    {session.member ? null : (
      <>
        <Spacer height={10} />

        <Text size="1" color="gray600">
          Usage through an API key or Bedrock carries no email, so it cannot be tied to a
          person.
        </Text>
      </>
    )}
  </Box>
);

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
  let { copy, copied } = useCopy(sessionId);

  let owner = session?.member?.name ? firstName(session.member.name) : null;
  let path = Paths.instance.agentTracking.session(
    ctx.organization,
    ctx.project,
    ctx.instance,
    sessionId
  );

  let description = session
    ? [
        `By ${memberName(session.member)}`,
        formatTimeSpan(session.startedAt, session.endedAt ?? session.lastActivityAt, now),
        [clientLabel(session.client), clientVersion(session.client)].filter(Boolean).join(' '),
        session.client.surface
      ]
        .filter(Boolean)
        .join(' · ')
    : undefined;

  return (
    <PageHeader
      title="Session"
      description={description}
      pagination={[
        { label: 'Sessions', href: sessionsPath(ctx) },
        { label: sessionId, href: path }
      ]}
      actions={
        session ? (
          <Flex gap={8}>
            <Button
              size="2"
              variant="outline"
              iconLeft={<RiFileCopyLine />}
              success={copied}
              onClick={() => copy()}
            >
              Copy Session ID
            </Button>

            {session.member ? (
              <Link to={memberSessionsPath(ctx, session.member.id)}>
                <Button size="2" variant="outline" as="span">
                  {owner ? `${owner}'s Sessions` : "This Member's Sessions"}
                </Button>
              </Link>
            ) : null}
          </Flex>
        ) : undefined
      }
    />
  );
};

let SessionDetail = ({ session }: { session: Session }) => (
  <Flex direction="column" gap={20}>
    <SessionHeader sessionId={session.id} session={session} />

    <Columns>
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
    </Columns>
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
