import type {
  DashboardInstanceChatsChannelsGetOutput,
  DashboardInstanceChatsChannelsListOutput,
  DashboardInstanceChatsChannelsListQuery,
  DashboardInstanceChatsChannelsMembersListOutput,
  DashboardInstanceChatsChannelsMembersListQuery,
  DashboardInstanceChatsGetOutput,
  DashboardInstanceChatsListOutput,
  DashboardInstanceChatsListQuery
} from '@metorial/dashboard-sdk';
import { createLoader } from '@metorial/data-hooks';
import { usePaginator } from '../../lib/usePaginator';
import { withAuth } from '../../user';
import { chatInstancesLoader } from './chatInstances';

export type ChatPreview = DashboardInstanceChatsListOutput['items'][number];
export type Chat = DashboardInstanceChatsGetOutput;
export type ChatChannelPreview = DashboardInstanceChatsChannelsListOutput['items'][number];
export type ChatChannel = DashboardInstanceChatsChannelsGetOutput;
export type ChatChannelMember =
  DashboardInstanceChatsChannelsMembersListOutput['items'][number];

export let chatsLoader = createLoader({
  name: 'chats',
  parents: [chatInstancesLoader],
  fetch: (i: { instanceId: string } & DashboardInstanceChatsListQuery) =>
    withAuth(sdk => {
      let { instanceId, ...query } = i;
      return sdk.chat.list(instanceId, query);
    }),
  mutators: {}
});

export let useChats = (
  instanceId: string | null | undefined,
  query?: DashboardInstanceChatsListQuery
) =>
  usePaginator(pagination =>
    chatsLoader.use(instanceId ? { instanceId, ...pagination, ...query } : null)
  );

export let chatLoader = createLoader({
  name: 'chat',
  parents: [chatsLoader],
  fetch: (i: { instanceId: string; chatId: string }) =>
    withAuth(sdk => sdk.chat.get(i.instanceId, i.chatId)),
  mutators: {}
});

export let useChat = (
  instanceId: string | null | undefined,
  chatId: string | null | undefined
) => chatLoader.use(instanceId && chatId ? { instanceId, chatId } : null);

export let chatChannelsLoader = createLoader({
  name: 'chatChannels',
  parents: [chatLoader],
  fetch: (
    i: { instanceId: string; chatId: string } & DashboardInstanceChatsChannelsListQuery
  ) =>
    withAuth(sdk => {
      let { instanceId, chatId, ...query } = i;
      return sdk.chat.channels.list(instanceId, chatId, query);
    }),
  mutators: {}
});

export let useChatChannels = (
  instanceId: string | null | undefined,
  chatId: string | null | undefined,
  query?: DashboardInstanceChatsChannelsListQuery
) =>
  usePaginator(pagination =>
    chatChannelsLoader.use(
      instanceId && chatId ? { instanceId, chatId, ...pagination, ...query } : null
    )
  );

export let chatChannelLoader = createLoader({
  name: 'chatChannel',
  parents: [chatChannelsLoader],
  fetch: (i: { instanceId: string; chatId: string; channelId: string }) =>
    withAuth(sdk => sdk.chat.channels.get(i.instanceId, i.chatId, i.channelId)),
  mutators: {}
});

export let useChatChannel = (
  instanceId: string | null | undefined,
  chatId: string | null | undefined,
  channelId: string | null | undefined
) =>
  chatChannelLoader.use(
    instanceId && chatId && channelId ? { instanceId, chatId, channelId } : null
  );

export let chatChannelMembersLoader = createLoader({
  name: 'chatChannelMembers',
  parents: [chatChannelLoader],
  fetch: (
    i: {
      instanceId: string;
      chatId: string;
      channelId: string;
    } & DashboardInstanceChatsChannelsMembersListQuery
  ) =>
    withAuth(sdk => {
      let { instanceId, chatId, channelId, ...query } = i;
      return sdk.chat.channels.members.list(instanceId, chatId, channelId, query);
    }),
  mutators: {}
});

export let useChatChannelMembers = (
  instanceId: string | null | undefined,
  chatId: string | null | undefined,
  channelId: string | null | undefined,
  query?: DashboardInstanceChatsChannelsMembersListQuery
) =>
  usePaginator(pagination =>
    chatChannelMembersLoader.use(
      instanceId && chatId && channelId
        ? { instanceId, chatId, channelId, ...pagination, ...query }
        : null
    )
  );
