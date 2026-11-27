import { EmptyValue } from '@metorial/data-list';
import { Paths } from '@metorial/frontend-config';
import { useAgentTrackingToolCallSessions } from '@metorial/state';
import { Text, theme } from '@metorial/ui';
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import styled from 'styled-components';
import type { InstanceContext } from '../../lib/dataList';
import {
  agentSessionsByToolCall,
  agentSessionSummary,
  toolCallSessionLookupIds,
  type AgentSession
} from './toolCallLinks';

let SessionLink = styled(Link)`
  display: flex;
  flex-direction: column;
  gap: 2px;
  max-width: 200px;
  min-width: 0;
  color: inherit;
  text-decoration: none;

  &:hover > :first-child {
    color: ${theme.colors.primary};
    text-decoration: underline;
  }
`;

export let useToolCallAgentSessions = <Item extends { id: string }>(
  items: Item[],
  instanceId: string
) => {
  let toolCallIds = useMemo(() => toolCallSessionLookupIds(items), [items]);
  let sessions = useAgentTrackingToolCallSessions(instanceId, toolCallIds);
  let byToolCall = useMemo(
    () => agentSessionsByToolCall(sessions.data?.items),
    [sessions.data]
  );

  return {
    items: useMemo(
      () => items.map(item => ({ ...item, agentSession: byToolCall.get(item.id) ?? null })),
      [items, byToolCall]
    )
  };
};

export let AgentSessionCell = ({
  session,
  ctx
}: {
  session: AgentSession | null;
  ctx: InstanceContext;
}) => {
  if (!session) return <EmptyValue />;

  let summary = agentSessionSummary(session);

  return (
    <SessionLink
      to={Paths.instance.agentTracking.session(
        ctx.organization,
        ctx.project,
        ctx.instance,
        session.id
      )}
      title={[summary.client, summary.details].filter(Boolean).join(' · ')}
    >
      <Text as="span" size="2" weight="medium" truncate>
        {summary.client}
      </Text>
      {summary.details ? (
        <Text as="span" size="1" color="gray600" truncate>
          {summary.details}
        </Text>
      ) : null}
    </SessionLink>
  );
};
