import { formatNumber } from '@metorial/chart';
import type { DashboardInstanceAgentTrackingSessionsListOutput } from '@metorial/dashboard-sdk';
import { col, createDataList, defineAction, f, withDefaults } from '@metorial/data-list';
import { Paths } from '@metorial/frontend-config';
import { useAgentTrackingSessions } from '@metorial/state';
import { Flex, Text, useCopy } from '@metorial/ui';
import { RiFileCopyLine, RiUserLine } from '@remixicon/react';
import { useNavigate } from 'react-router-dom';
import { useInstanceContext, type InstanceContext } from '../../lib/dataList';
import { agentTrackingFilters } from './filters';
import { WithInfo } from './info';
import { MemberIdentity, memberPath } from './memberParts';
import { lastActiveRangeFilter, lastActiveRangeQuery, useLastActiveRange } from './range';
import { repositoryLabel } from './sessionContext';
import {
  FirstAndRest,
  SessionCost,
  SessionModels,
  SessionSummaryCell,
  settlingLabel
} from './sessionParts';
import { clientLabel } from './spendSummary';

let filterRangeText = 'the last 30 days';

let listCellWidths = { repository: 190, branch: 150, tickets: 100 };

type Session = DashboardInstanceAgentTrackingSessionsListOutput['items'][number];

type ListProps = { instanceId: string; memberId?: string };

let costMarkers = `~ means estimated, not a bill. No ~ means billed by the provider. ${settlingLabel}: the cost arrives 30 to 90 seconds after activity.`;

let memberColumn = col.custom<Session>({
  id: 'member',
  header: 'Member',
  render: row => <MemberIdentity member={row.member} />
});

let copyIdAction = defineAction<Session, ListProps, InstanceContext>({
  id: 'copy-id',
  label: 'Copy Session ID',
  icon: <RiFileCopyLine />,
  row: true,
  bulk: false,
  useRun: () => {
    let { copy } = useCopy();
    return row => copy(row.id);
  }
});

let memberAction = defineAction<Session, ListProps, InstanceContext>({
  id: 'open-member',
  label: 'Open Member',
  icon: <RiUserLine />,
  row: true,
  bulk: false,
  hidden: row => !row.member,
  useRun: ({ ctx }) => {
    let navigate = useNavigate();
    let { range } = useLastActiveRange();

    return row => {
      if (row.member) navigate(memberPath(ctx, row.member.id, range));
    };
  }
});

let buildSessionsList = (name: string, d: { forMember: boolean }) =>
  createDataList<ListProps>(name)
    .context(useInstanceContext)
    .filters(props => {
      let common = {
        modelId: f.entity(agentTrackingFilters.model(props.instanceId, filterRangeText)),
        clientFamily: f.entity(agentTrackingFilters.client(props.instanceId, filterRangeText)),
        repositoryId: f.entity(
          agentTrackingFilters.repository(props.instanceId, filterRangeText)
        ),
        branch: f.entity(agentTrackingFilters.branch(props.instanceId, filterRangeText)),
        ticket: f.entity(agentTrackingFilters.ticket(props.instanceId, filterRangeText)),
        range: lastActiveRangeFilter
      };

      return d.forMember
        ? common
        : {
            memberId: f.entity(agentTrackingFilters.member(props.instanceId, filterRangeText)),
            ...common
          };
    })
    .paginated(({ props, filters, limit }) => {
      let memberId = props.memberId ?? ('memberId' in filters ? filters.memberId : undefined);

      return useAgentTrackingSessions(
        props.instanceId,
        withDefaults(
          { order: 'desc' as const },
          {
            limit,
            memberId,
            modelId: filters.modelId,
            clientFamily: filters.clientFamily,
            repositoryId: filters.repositoryId,
            branch: filters.branch,
            ticket: filters.ticket,
            ...lastActiveRangeQuery(filters.range?.[0])
          }
        )
      );
    })
    .columns([
      ...(d.forMember ? [] : [memberColumn]),
      col.custom<Session>({
        id: 'models',
        header: 'Models',
        render: row => <SessionModels session={row} />
      }),
      col.custom<Session>({
        id: 'repository',
        header: 'Repository',
        render: row => (
          <FirstAndRest
            names={row.context.repositories.map(repositoryLabel)}
            maxWidth={listCellWidths.repository}
          />
        )
      }),
      col.custom<Session>({
        id: 'branch',
        header: 'Branch',
        isDefault: false,
        render: row => (
          <FirstAndRest
            names={row.context.branch ? [row.context.branch] : []}
            maxWidth={listCellWidths.branch}
          />
        )
      }),
      col.custom<Session>({
        id: 'tickets',
        header: 'Tickets',
        render: row => (
          <FirstAndRest
            names={row.context.tickets.map(ticket => ticket.key)}
            maxWidth={listCellWidths.tickets}
          />
        )
      }),
      col.twoLine<Session>({
        id: 'client',
        header: 'Client',
        isDefault: false,
        primary: row => clientLabel(row.client),
        secondary: row => row.client.surface
      }),
      col.text<Session>({
        id: 'requests',
        header: 'Requests',
        isDefault: false,
        get: row => formatNumber(row.requests)
      }),
      col.date<Session>('startedAt', { header: 'Started' }),
      col.custom<Session>({
        id: 'session',
        header: 'Session',
        render: row => <SessionSummaryCell session={row} />
      }),
      col.custom<Session>({
        id: 'cost',
        header: 'Cost',
        render: row => <SessionCost session={row} />
      }),
      col.date<Session>('lastActivityAt', { header: 'Last Active', isDefault: true })
    ])
    .link((row, _props, ctx) =>
      Paths.instance.agentTracking.session(ctx.organization, ctx.project, ctx.instance, row.id)
    )
    .itemActions(d.forMember ? [copyIdAction] : [copyIdAction, memberAction])
    .build();

let AgentTrackingSessionsList = buildSessionsList('agent-usage-sessions', {
  forMember: false
});

let AgentTrackingMemberSessionsList = buildSessionsList('agent-usage-member-sessions', {
  forMember: true
});

let SessionsLegend = () => (
  <WithInfo info={costMarkers}>
    <Text as="span" size="1" color="gray600">
      About Costs
    </Text>
  </WithInfo>
);

export let AgentTrackingSessionsTable = ({
  instanceId,
  memberId
}: {
  instanceId: string;
  memberId?: string;
}) => {
  let List = memberId ? AgentTrackingMemberSessionsList : AgentTrackingSessionsList;

  return (
    <Flex direction="column" gap={14}>
      <List
        instanceId={instanceId}
        memberId={memberId}
        emptyState={{
          initial: memberId ? 'No sessions of this member yet.' : 'No sessions yet.',
          filtered:
            'No sessions match these filters. A session joins a model filter about 30 seconds after its first request.'
        }}
      />

      <SessionsLegend />
    </Flex>
  );
};
