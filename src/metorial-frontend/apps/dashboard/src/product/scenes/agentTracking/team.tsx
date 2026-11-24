import { formatNumber } from '@metorial/chart';
import type { DashboardInstanceAgentTrackingMembersListOutput } from '@metorial/dashboard-sdk';
import { col, createDataList } from '@metorial/data-list';
import { PaginationSearchParamsProvider } from '@metorial/data-hooks';
import { useAgentTrackingMembers } from '@metorial/state';
import { Callout, Flex } from '@metorial/ui';
import { useInstanceContext } from '../../lib/dataList';
import { CostValue } from './cost';
import { lastActivePhrase, memberListLimit, MemberIdentity, memberPath } from './memberParts';
import {
  lastActiveRangeFilter,
  lastActiveRangeQuery,
  type AgentTrackingRangePreset
} from './range';
import { TeamViewFilters } from './views/controls';
import { TeamViewHeader } from './views/header';
import { TeamInsights } from './views/insights';
import { useTeamViewSearch } from './views/state';

type TeamMember = DashboardInstanceAgentTrackingMembersListOutput['items'][number];

type TeamListProps = { instanceId: string; range?: AgentTrackingRangePreset };

let teamFilters = { range: lastActiveRangeFilter };

let AgentTrackingTeamList = createDataList<TeamListProps>('agent-tracking-team')
  .context(useInstanceContext)
  .filters(() => teamFilters)
  .paginated(({ props, limit }) =>
    useAgentTrackingMembers(props.instanceId, { limit, ...lastActiveRangeQuery(props.range) })
  )
  .columns([
    col.custom<TeamMember>({
      id: 'member',
      header: 'Member',
      render: row => <MemberIdentity member={row} />
    }),
    col.text<TeamMember>({
      id: 'sessions',
      header: 'Sessions',
      get: row => formatNumber(row.sessions)
    }),
    col.custom<TeamMember>({
      id: 'cost',
      header: 'Cost',
      render: row => <CostValue cost={row.cost} />
    }),
    col.date<TeamMember>('lastSeenAt', { header: 'Last Active', isDefault: true })
  ])
  .link((row, props, ctx) => memberPath(ctx, row.id, props.range))
  .build();

let RecentActivityNotice = ({ instanceId, range }: TeamListProps) => {
  let members = useAgentTrackingMembers(instanceId, {
    limit: 1,
    ...lastActiveRangeQuery(range)
  });

  if (!members.data?.items[0]?.listTruncated) return null;

  return (
    <Callout color="gray">
      {`More than ${formatNumber(memberListLimit)} people were active ${lastActivePhrase(range)}. Only the ${formatNumber(memberListLimit)} most recently active are listed.`}
    </Callout>
  );
};

let RecentActivityTable = ({ instanceId, range }: TeamListProps) => (
  <AgentTrackingTeamList
    instanceId={instanceId}
    range={range}
    emptyState={{
      initial:
        'Nobody has sent usage to this instance yet. Members show up here within a minute of their first session.',
      filtered: 'Nobody was active in this range.'
    }}
  />
);

export let AgentTrackingTeam = ({ instanceId }: { instanceId: string }) => {
  let { state, savedId, apply, patch, current } = useTeamViewSearch();

  return (
    <Flex direction="column" gap={20}>
      <TeamViewHeader instanceId={instanceId} view={state} savedId={savedId} apply={apply}>
        {state.kind == 'recent' ? null : (
          <TeamViewFilters
            instanceId={instanceId}
            view={state}
            current={current}
            onPatch={patch}
          />
        )}
      </TeamViewHeader>

      {state.kind == 'recent' ? (
        <Flex direction="column" gap={14}>
          <RecentActivityNotice instanceId={instanceId} range={state.params.range} />

          <PaginationSearchParamsProvider enabled={true}>
            <RecentActivityTable instanceId={instanceId} range={state.params.range} />
          </PaginationSearchParamsProvider>
        </Flex>
      ) : (
        <TeamInsights instanceId={instanceId} view={state} onPatch={patch} />
      )}
    </Flex>
  );
};
