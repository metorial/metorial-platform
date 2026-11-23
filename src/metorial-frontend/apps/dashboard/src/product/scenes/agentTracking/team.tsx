import { formatNumber } from '@metorial/chart';
import type { DashboardInstanceAgentTrackingMembersListOutput } from '@metorial/dashboard-sdk';
import { col, createDataList } from '@metorial/data-list';
import { PaginationSearchParamsProvider } from '@metorial/data-hooks';
import { useAgentTrackingMembers } from '@metorial/state';
import { Callout, Flex } from '@metorial/ui';
import { useInstanceContext } from '../../lib/dataList';
import { CostValue } from './cost';
import { lastActivePhrase, memberListLimit, MemberIdentity, memberPath } from './memberParts';
import { lastActiveRangeFilter, lastActiveRangeQuery, useLastActiveRange } from './range';
import { TeamViewControls } from './views/controls';
import { TeamInsights } from './views/insights';
import { useTeamViewSearch } from './views/state';
import { TeamViewSwitcher } from './views/switcher';

type TeamMember = DashboardInstanceAgentTrackingMembersListOutput['items'][number];

let teamFilters = { range: lastActiveRangeFilter };

let useTeamContext = () => ({ ...useInstanceContext(), ...useLastActiveRange() });

let AgentTrackingTeamList = createDataList<{ instanceId: string }>('agent-tracking-team')
  .context(useTeamContext)
  .filters(() => teamFilters)
  .paginated(({ props, filters, limit }) =>
    useAgentTrackingMembers(props.instanceId, {
      limit,
      ...lastActiveRangeQuery(filters.range?.[0])
    })
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
  .link((row, _props, ctx) => memberPath(ctx, row.id, ctx.range))
  .build();

export let AgentTrackingTeamNotice = ({ instanceId }: { instanceId: string }) => {
  let range = useLastActiveRange();
  let members = useAgentTrackingMembers(instanceId, { limit: 1, ...range });

  if (!members.data?.items[0]?.listTruncated) return null;

  return (
    <Callout color="gray">
      {`More than ${formatNumber(memberListLimit)} people were active ${lastActivePhrase(range.range)}. Only the ${formatNumber(memberListLimit)} most recently active are listed.`}
    </Callout>
  );
};

export let AgentTrackingTeamTable = ({ instanceId }: { instanceId: string }) => (
  <AgentTrackingTeamList
    instanceId={instanceId}
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
      <TeamViewSwitcher
        instanceId={instanceId}
        view={state}
        savedId={savedId}
        apply={apply}
        current={current}
      />

      {state.kind == 'recent' ? (
        <Flex direction="column" gap={14}>
          <AgentTrackingTeamNotice instanceId={instanceId} />

          <PaginationSearchParamsProvider enabled={true}>
            <AgentTrackingTeamTable instanceId={instanceId} />
          </PaginationSearchParamsProvider>
        </Flex>
      ) : (
        <Flex direction="column" gap={14}>
          <TeamViewControls
            instanceId={instanceId}
            view={state}
            current={current}
            onPatch={patch}
          />

          <TeamInsights instanceId={instanceId} view={state} />
        </Flex>
      )}
    </Flex>
  );
};
