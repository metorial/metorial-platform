import { canonicalize } from '@lowerdeck/canonicalize';
import { formatNumber, formatPercent } from '@metorial/chart';
import type { DashboardInstanceAgentTrackingSessionsGetOutput } from '@metorial/dashboard-sdk';
import { renderWithLoader } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import { PageHeader } from '@metorial/layout';
import { MetricsSummary } from '@metorial/metrics-page';
import { useAgentTrackingSession } from '@metorial/state';
import { Badge, Button, Callout, Datalist, Flex, RenderDate, Text, theme } from '@metorial/ui';
import { Box, ID, Table } from '@metorial/ui-product';
import { useNow } from '@metorial/use-now';
import { Link } from 'react-router-dom';
import styled from 'styled-components';
import { useInstanceContext, type InstanceContext } from '../../lib/dataList';
import { formatSpan, formatTimeSpan, sessionHeading, sessionLength } from './activity';
import { CostValue } from './cost';
import { agentTrackingErrorStatus, AgentTrackingErrorState } from './errorState';
import { WithInfo } from './info';
import { MemberDetails, memberPath } from './memberParts';
import { unknownProviderLabel } from './providerCalls';
import {
  linesChangedLabel,
  otherDefaultBranch,
  pullRequestKindLabels,
  pullRequestLabel,
  repositoryLabel,
  shortSha,
  worktreeLabel
} from './sessionContext';
import { describeSessionCost, sessionCostKind } from './sessionCost';
import { SessionToolCallsBox } from './sessionToolCalls';
import {
  clientVersion,
  costIsSettling,
  DetailColumns,
  MaybeLink,
  ModelNameCell,
  SessionActivityLabel,
  settlingLabel,
  TicketLinks
} from './sessionParts';
import { clientLabel, formatRequests } from './spendSummary';

type Session = DashboardInstanceAgentTrackingSessionsGetOutput;

let tokenKinds = [
  { id: 'input', label: 'Input' },
  { id: 'output', label: 'Output' },
  { id: 'cacheRead', label: 'Cache Read' },
  { id: 'cacheWrite', label: 'Cache Write' },
  { id: 'reasoning', label: 'Reasoning' }
] as const;

let RowList = styled.div`
  display: flex;
  flex-direction: column;

  & > * + * {
    border-top: 1px solid ${theme.colors.gray300};
  }
`;

let ListRow = styled.div`
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
          label: (
            <WithInfo
              info={describeSessionCost({
                cost: session.cost,
                billingModes: session.billingModes,
                requests: session.requests,
                memberName: session.member?.name ?? null
              })}
            >
              Cost
            </WithInfo>
          ),
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
          label: <WithInfo info="From first to last activity.">Length</WithInfo>,
          value: formatSpan(sessionLength(session))
        }
      ]}
    />
  );
};

let CostExplanation = ({ session }: { session: Session }) =>
  costIsSettling(session) ? (
    <Callout color="gray">
      This session's cost is still settling. Cost, tokens and models arrive 30 to 90 seconds
      after activity.
    </Callout>
  ) : null;

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
      <RowList>
        {session.usageByModel.map(usage => (
          <ListRow key={usage.key}>
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
          </ListRow>
        ))}
      </RowList>
    ) : (
      <Text size="2" color="gray600">
        No model usage recorded.
      </Text>
    )}
  </Box>
);

let contextItems = (context: Session['context']) => {
  let defaultBranch = otherDefaultBranch(context);
  let worktree = worktreeLabel(context.worktree);
  let lines = linesChangedLabel(context.lines);

  return [
    context.repositories.length
      ? {
          label: context.repositories.length == 1 ? 'Repository' : 'Repositories',
          value: (
            <Flex direction="column" gap={2}>
              {context.repositories.map(repository => (
                <MaybeLink key={repository.id} url={repository.url}>
                  {repositoryLabel(repository)}
                </MaybeLink>
              ))}
            </Flex>
          )
        }
      : null,
    context.branch ? { label: 'Branch', value: context.branch } : null,
    defaultBranch ? { label: 'Default Branch', value: defaultBranch } : null,
    context.tickets.length
      ? { label: 'Tickets', value: <TicketLinks tickets={context.tickets} /> }
      : null,
    context.pullRequests.length
      ? {
          label: 'Pull Requests',
          value: (
            <Flex direction="column" gap={4}>
              {context.pullRequests.map(pullRequest => (
                <Flex key={pullRequest.key} gap={8} align="center">
                  <MaybeLink url={pullRequest.url}>{pullRequestLabel(pullRequest)}</MaybeLink>
                  <Badge size="1" color={pullRequest.kind == 'opened' ? 'green' : 'gray'}>
                    {pullRequestKindLabels[pullRequest.kind]}
                  </Badge>
                </Flex>
              ))}
            </Flex>
          )
        }
      : null,
    lines ? { label: 'Lines Changed', value: lines } : null,
    worktree ? { label: 'Worktree', value: worktree } : null,
    context.subPath ? { label: 'Sub-Path', value: context.subPath } : null,
    context.permissionMode ? { label: 'Permission Mode', value: context.permissionMode } : null
  ].filter(item => item !== null);
};

let CommitList = ({ commits }: { commits: Session['commits'] }) => (
  <RowList>
    {commits.map(commit => (
      <ListRow key={commit.sha}>
        <Flex direction="column" gap={2}>
          <Flex gap={8} align="center">
            <span title={commit.sha}>
              <Text as="span" size="2" weight="medium">
                {shortSha(commit.sha)}
              </Text>
            </span>
            {commit.aiAuthored ? (
              <Badge size="1" color="violet">
                AI Co-Authored
              </Badge>
            ) : null}
          </Flex>

          {commit.tickets.length ? <TicketLinks tickets={commit.tickets} /> : null}
        </Flex>

        <Text as="span" size="1" color="gray600" wrap="nowrap">
          <RenderDate date={commit.committedAt} />
        </Text>
      </ListRow>
    ))}
  </RowList>
);

let ProviderLinks = ({ providers }: { providers: Session['providers'] }) => {
  let ctx = useInstanceContext();

  return (
    <Flex gap={8} wrap="wrap">
      {providers.map(provider =>
        provider.name ? (
          <Link
            key={provider.id}
            to={Paths.instance.provider(
              ctx.organization,
              ctx.project,
              ctx.instance,
              provider.id
            )}
          >
            {provider.name}
          </Link>
        ) : (
          <Text key={provider.id} as="span" size="2" color="gray600">
            {unknownProviderLabel}
          </Text>
        )
      )}
    </Flex>
  );
};

let ContextBox = ({ session }: { session: Session }) => {
  let items = [
    ...contextItems(session.context),
    ...(session.providers.length
      ? [{ label: 'Providers', value: <ProviderLinks providers={session.providers} /> }]
      : [])
  ];

  return (
    <Box title="Context">
      {items.length || session.commits.length ? (
        <Flex direction="column" gap={16}>
          {items.length ? <Datalist items={items} /> : null}

          {session.commits.length ? (
            <Flex direction="column" gap={6}>
              <Text as="span" size="2" weight="medium">
                Commits
              </Text>
              <CommitList commits={session.commits} />
            </Flex>
          ) : null}
        </Flex>
      ) : (
        <Text size="2" color="gray600">
          No repository information was reported for this session.
        </Text>
      )}
    </Box>
  );
};

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

  let heading = session ? sessionHeading(session, now) : null;
  let title = heading?.title ?? 'Session';
  let path = Paths.instance.agentTracking.session(
    ctx.organization,
    ctx.project,
    ctx.instance,
    sessionId
  );

  let description = session
    ? [
        heading?.byline,
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

let SessionDetail = ({ instanceId, session }: { instanceId: string; session: Session }) => (
  <Flex direction="column" gap={20}>
    <SessionHeader sessionId={session.id} session={session} />

    <DetailColumns>
      <Flex direction="column" gap={20}>
        <SessionFigures session={session} />
        <CostExplanation session={session} />
        <ContextBox session={session} />
        <SessionToolCallsBox instanceId={instanceId} sessionId={session.id} />
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
  )(({ session }) => <SessionDetail instanceId={instanceId} session={session.data} />);
};
