import { Paths } from '@metorial/frontend-config';
import {
  useAgentTrackingInstanceSettings,
  useAgentTrackingProviderCalls
} from '@metorial/state';
import { useInstanceContext } from '../../lib/dataList';
import { UsageTopList } from '../instanceUsage/cards';
import type { UsageRange } from '../instanceUsage/query';
import { useAgentTrackingAvailability } from './access';
import { memberPath } from './memberParts';
import { agentCallGroups, providerCallRows, type ProviderCallGroup } from './providerCalls';
import { getBrowserTimeZone, withQuery } from './range';

let cardLimit = 8;

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
  if (calls.error) return null;

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
      rows={rows}
      emptyText="No coding agent tool calls in this range."
    />
  );
};

export let UsageAgentCallCards = ({ range }: { range: UsageRange }) => {
  let ctx = useInstanceContext();
  let { available } = useAgentTrackingAvailability();
  let settings = useAgentTrackingInstanceSettings(available ? ctx.instanceId : null);

  let groups = agentCallGroups({
    available,
    settings: {
      loaded: !!settings.data,
      failed: !!settings.error,
      hideIndividuals: !!settings.data?.privacy.hideIndividuals
    }
  });
  if (!ctx.instanceId) return null;

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
