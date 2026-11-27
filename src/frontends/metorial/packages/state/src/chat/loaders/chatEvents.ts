import type {
  DashboardInstanceChatEventsGetOutput,
  DashboardInstanceChatEventsListOutput,
  DashboardInstanceChatEventsListQuery
} from '@metorial/dashboard-sdk';
import { createLoader } from '@metorial/data-hooks';
import { usePaginator } from '../../lib/usePaginator';
import { withAuth } from '../../user';
import { chatConnectionsLoader } from './chatConnections';

export type ChatEventPreview = DashboardInstanceChatEventsListOutput['items'][number];
export type ChatEvent = DashboardInstanceChatEventsGetOutput;

export let chatEventsLoader = createLoader({
  name: 'chatEvents',
  parents: [chatConnectionsLoader],
  fetch: (i: { instanceId: string } & DashboardInstanceChatEventsListQuery) =>
    withAuth(sdk => {
      let { instanceId, ...query } = i;
      return sdk.chat.events.list(instanceId, query);
    }),
  mutators: {}
});

export let useChatEvents = (
  instanceId: string | null | undefined,
  query?: DashboardInstanceChatEventsListQuery
) =>
  usePaginator(pagination =>
    chatEventsLoader.use(instanceId ? { instanceId, ...pagination, ...query } : null)
  );

export let chatEventLoader = createLoader({
  name: 'chatEvent',
  parents: [chatEventsLoader],
  fetch: (i: { instanceId: string; chatEventId: string }) =>
    withAuth(sdk => sdk.chat.events.get(i.instanceId, i.chatEventId)),
  mutators: {}
});

export let useChatEvent = (
  instanceId: string | null | undefined,
  chatEventId: string | null | undefined
) => chatEventLoader.use(instanceId && chatEventId ? { instanceId, chatEventId } : null);
