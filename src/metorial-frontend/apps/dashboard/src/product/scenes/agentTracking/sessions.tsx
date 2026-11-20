import { formatNumber } from '@metorial/chart';
import type { DashboardInstanceAgentTrackingSessionsListOutput } from '@metorial/dashboard-sdk';
import { col, createDataList, defineAction, f, withDefaults } from '@metorial/data-list';
import { Paths } from '@metorial/frontend-config';
import { useAgentTrackingSessions } from '@metorial/state';
import { Flex, RenderDate, Text, useCopy } from '@metorial/ui';
import { useNow } from '@metorial/use-now';
import { RiFileCopyLine, RiUserLine } from '@remixicon/react';
import { useNavigate } from 'react-router-dom';
import { useInstanceContext, type InstanceContext } from '../../lib/dataList';
import { formatDayLabel, formatTime } from './activity';
import { agentTrackingFilters } from './filters';
import { MemberIdentity } from './member';
import { agentTrackingRangePresets, getBrowserTimeZone } from './range';
import {
  clientLabel,
  clientVersion,
  SessionActivityLabel,
  SessionCost,
  SessionModels,
  SessionSummaryCell,
  settlingLabel
} from './sessionParts';

let filterScope = { range: 'last_30_days', rangeText: 'the last 30 days' } as const;

type Session = DashboardInstanceAgentTrackingSessionsListOutput['items'][number];

let legend = [
  { key: '~', text: 'Estimated, not a bill' },
  { key: 'No ~', text: 'Billed by the provider' },
  { key: settlingLabel, text: 'Cost arrives 30 to 90 seconds after activity' },
  { key: 'Active Now', text: 'Activity in the last 5 minutes' },
  { key: 'Idle', text: 'Quiet for the time shown, and may already be closed' },
  { key: 'Ended', text: 'Quiet for a day, or closed where Claude Code reports it' }
];

let sessionPath = (ctx: InstanceContext, sessionId: string) =>
  Paths.instance.agentTracking.session(ctx.organization, ctx.project, ctx.instance, sessionId);

export let memberSessionsPath = (ctx: InstanceContext, memberId: string) =>
  `${Paths.instance.agentTracking.sessions(ctx.organization, ctx.project, ctx.instance)}?memberId=${encodeURIComponent(memberId)}`;

let LastActiveCell = ({ session }: { session: Session }) => {
  let now = useNow();

  return (
    <Flex direction="column" gap={2}>
      <Text as="span" size="2">
        {formatTime(session.lastActivityAt)}
      </Text>

      <Text as="span" size="1" color="gray600">
        {formatDayLabel(session.lastActivityAt, now)}
      </Text>
    </Flex>
  );
};

let AgentTrackingSessionsList = createDataList<{ instanceId: string }>(
  'agent-tracking-sessions'
)
  .context(useInstanceContext)
  .filters(props => {
    let byField = agentTrackingFilters(props.instanceId, filterScope, [
      'member',
      'model',
      'client'
    ]);

    return {
      memberId: f.entity(byField.member),
      modelId: f.entity(byField.model),
      clientFamily: f.entity(byField.client),
      range: f.select('range', 'Last Active', agentTrackingRangePresets, {
        description: 'Filter by last activity',
        highlight: { exclusive: true, label: 'Last Active', preserveOrder: true }
      })
    };
  })
  .paginated(({ props, filters, limit }) => {
    let range = filters.range?.[0];

    return useAgentTrackingSessions(
      props.instanceId,
      withDefaults(
        { order: 'desc' as const },
        {
          limit,
          memberId: filters.memberId,
          modelId: filters.modelId,
          clientFamily: filters.clientFamily,
          range,
          timeZone: range ? getBrowserTimeZone() : undefined
        }
      )
    );
  })
  .columns([
    col.custom<Session>({
      id: 'lastActivityAt',
      header: 'Last Active',
      render: row => <LastActiveCell session={row} />
    }),
    col.custom<Session>({
      id: 'session',
      header: 'Session',
      render: row => <SessionSummaryCell session={row} />
    }),
    col.custom<Session>({
      id: 'member',
      header: 'Member',
      render: row => <MemberIdentity member={row.member} />
    }),
    col.custom<Session>({
      id: 'models',
      header: 'Models',
      render: row => <SessionModels session={row} />
    }),
    col.custom<Session>({
      id: 'cost',
      header: 'Cost',
      render: row => <SessionCost session={row} />
    }),
    col.custom<Session>({
      id: 'activity',
      header: 'Activity',
      render: row => <SessionActivityLabel session={row} />
    }),
    col.twoLine<Session>({
      id: 'client',
      header: 'Client',
      isDefault: false,
      primary: row => clientLabel(row.client),
      secondary: row =>
        [row.client.surface, clientVersion(row.client)].filter(Boolean).join(' · ') || null
    }),
    col.custom<Session>({
      id: 'requests',
      header: 'Requests',
      isDefault: false,
      render: row => <Text size="2">{formatNumber(row.requests)}</Text>
    }),
    col.custom<Session>({
      id: 'startedAt',
      header: 'Started',
      isDefault: false,
      render: row => <RenderDate date={row.startedAt} />
    })
  ])
  .link((row, _props, ctx) => sessionPath(ctx, row.id))
  .itemActions([
    defineAction<Session, { instanceId: string }, InstanceContext>({
      id: 'copy-id',
      label: 'Copy Session ID',
      icon: <RiFileCopyLine />,
      row: true,
      bulk: false,
      useRun: () => {
        let { copy } = useCopy();
        return row => copy(row.id);
      }
    }),
    defineAction<Session, { instanceId: string }, InstanceContext>({
      id: 'member-sessions',
      label: "Show This Member's Sessions",
      icon: <RiUserLine />,
      row: true,
      bulk: false,
      hidden: row => !row.member,
      useRun: ({ ctx }) => {
        let navigate = useNavigate();
        return row => {
          if (row.member) navigate(memberSessionsPath(ctx, row.member.id));
        };
      }
    })
  ])
  .build();

let SessionsLegend = () => (
  <Flex gap={18} wrap="wrap">
    {legend.map(item => (
      <Text key={item.key} as="span" size="1" color="gray600">
        <Text as="span" size="1" weight="strong" color="gray800">
          {item.key}
        </Text>{' '}
        {item.text}
      </Text>
    ))}
  </Flex>
);

export let AgentTrackingSessionsTable = ({ instanceId }: { instanceId: string }) => (
  <Flex direction="column" gap={14}>
    <AgentTrackingSessionsList
      instanceId={instanceId}
      emptyState={{
        initial: 'No sessions yet.',
        filtered:
          'No sessions match these filters. A session joins a model filter about 30 seconds after its first request.'
      }}
    />

    <SessionsLegend />
  </Flex>
);
