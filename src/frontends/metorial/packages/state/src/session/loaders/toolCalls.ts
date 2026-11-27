import { DashboardInstanceToolCallsListQuery } from '@metorial/dashboard-sdk';
import { createLoader } from '@metorial/data-hooks';
import { usePaginator } from '../../lib/usePaginator';
import { withAuth } from '../../user';

export let toolCallsLoader = createLoader({
  name: 'toolCalls',
  parents: [],
  fetch: (i: { instanceId: string } & DashboardInstanceToolCallsListQuery) =>
    withAuth(sdk => sdk.sessions.toolCalls.list(i.instanceId, i)),
  mutators: {}
});

export let useToolCalls = (
  instanceId: string | null | undefined,
  query?: DashboardInstanceToolCallsListQuery
) => {
  return usePaginator(pagination =>
    toolCallsLoader.use(instanceId ? { instanceId, ...pagination, ...query } : null)
  );
};

export let toolCallLoader = createLoader({
  name: 'toolCall',
  parents: [toolCallsLoader],
  fetch: (i: { instanceId: string; toolCallId: string }) =>
    withAuth(sdk => sdk.sessions.toolCalls.get(i.instanceId, i.toolCallId)),
  mutators: {}
});

export let useToolCall = (
  instanceId: string | null | undefined,
  toolCallId: string | null | undefined
) => {
  return toolCallLoader.use(instanceId && toolCallId ? { instanceId, toolCallId } : null);
};
