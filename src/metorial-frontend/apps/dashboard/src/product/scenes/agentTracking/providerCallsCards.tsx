import { Paths } from '@metorial/frontend-config';
import { useAgentTrackingProviderCalls } from '@metorial/state';
import { useInstanceContext } from '../../lib/dataList';
import { getUsageErrorMessage, UsageTopList } from '../instanceUsage/cards';
import type { UsageRange } from '../instanceUsage/query';
import { agentTrackingErrorStatus } from './errorState';
import { memberPath } from './memberParts';
import { useAgentTrackingIndividualsVisibility } from './privacy';
import { providerCallRows, type ProviderCallGroup } from './providerCalls';
import { getBrowserTimeZone, withQuery } from './range';

let cardLimit = 8;

let groups: ProviderCallGroup[] = ['repository', 'member'];

let cards: Record<ProviderCallGroup, { title: string; info: string }> = {
  repository: {
    title: 'Agent Calls By Repository',
    info: 'Tool calls from coding agents that report to Agent Usage (Claude Code and Codex), by the repository the agent worked in. Calls from other clients are not counted, and a call is counted a few minutes after it happens. Click a repository to open its agent sessions.'
  },
  member: {
    title: 'Agent Calls By Member',
    info: 'Tool calls from coding agents that report to Agent Usage (Claude Code and Codex), by the member who ran the agent. Calls from other clients are not counted, and a call is counted a few minutes after it happens. Click a member to open their agent usage.'
  }
};

let AgentCallsCard = ({
  instanceId,
  groupBy,
  range
}: {
  instanceId: string;
  groupBy: ProviderCallGroup;
  range: UsageRange;
}) => {
  let ctx = useInstanceContext();
  let calls = useAgentTrackingProviderCalls(instanceId, {
    groupBy,
    from: range.from,
    to: range.to,
    timeZone: getBrowserTimeZone()
  });
  if (agentTrackingErrorStatus(calls.error) == 403) return null;

  let rows = providerCallRows(calls.data?.items ?? [], {
    groupBy,
    repositoryHref: repositoryId =>
      withQuery(
        Paths.instance.agentTracking.sessions(ctx.organization, ctx.project, ctx.instance),
        { repositoryId }
      ),
    memberHref: memberId => memberPath(ctx, memberId)
  }).slice(0, cardLimit);

  return (
    <UsageTopList
      title={cards[groupBy].title}
      description="By tool calls"
      info={cards[groupBy].info}
      loading={calls.isLoading}
      error={getUsageErrorMessage(calls.error)}
      rows={rows}
      emptyText="No coding agent tool calls in this range."
    />
  );
};

export let UsageAgentCallCards = ({ range }: { range: UsageRange }) => {
  let ctx = useInstanceContext();
  let { visibility } = useAgentTrackingIndividualsVisibility();
  if (!ctx.instanceId || visibility != 'visible') return null;

  return (
    <>
      {groups.map(groupBy => (
        <AgentCallsCard
          key={groupBy}
          instanceId={ctx.instanceId!}
          groupBy={groupBy}
          range={range}
        />
      ))}
    </>
  );
};
