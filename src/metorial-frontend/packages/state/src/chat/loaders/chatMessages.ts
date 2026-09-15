import type {
  DashboardInstanceChatsMessagesCreateBody,
  DashboardInstanceChatsMessagesGetOutput,
  DashboardInstanceChatsMessagesListOutput,
  DashboardInstanceChatsMessagesListQuery,
  DashboardInstanceChatsMessagesReactionsCreateBody,
  DashboardInstanceChatsMessagesReactionsDeleteQuery,
  DashboardInstanceChatsThreadsGetOutput,
  DashboardInstanceChatsThreadsListOutput,
  DashboardInstanceChatsThreadsListQuery
} from '@metorial/dashboard-sdk';
import { createLoader } from '@metorial/data-hooks';
import { usePaginator } from '../../lib/usePaginator';
import { withAuth } from '../../user';
import { chatChannelLoader } from './chats';

export type ChatMessage = DashboardInstanceChatsMessagesListOutput['items'][number];
export type ChatMessageAuthor = NonNullable<ChatMessage['author']>;
export type ChatMessageReaction = NonNullable<ChatMessage['reactions']>[number];
export type ChatMessageEmoji = ChatMessageReaction['emoji'];
export type ChatThreadPreview = DashboardInstanceChatsThreadsListOutput['items'][number];
export type ChatThread = DashboardInstanceChatsThreadsGetOutput;

export let chatMessagesLoader = createLoader({
  name: 'chatMessages',
  parents: [chatChannelLoader],
  fetch: (
    i: { instanceId: string; chatId: string } & DashboardInstanceChatsMessagesListQuery
  ) =>
    withAuth(sdk => {
      let { instanceId, chatId, ...query } = i;
      return sdk.chat.messages.list(instanceId, chatId, query);
    }),
  mutators: {}
});

export let useChatMessages = (
  instanceId: string | null | undefined,
  chatId: string | null | undefined,
  query: DashboardInstanceChatsMessagesListQuery | null | undefined
) =>
  usePaginator(
    pagination =>
      chatMessagesLoader.use(
        instanceId && chatId && query ? { instanceId, chatId, ...pagination, ...query } : null
      ),
    query ? `${chatId}:${query.channelId}:${query.threadId ?? ''}:${query.search ?? ''}` : null
  );

export let chatMessageLoader = createLoader({
  name: 'chatMessage',
  parents: [chatMessagesLoader],
  fetch: (i: { instanceId: string; chatId: string; messageId: string; channelId: string }) =>
    withAuth(sdk =>
      sdk.chat.messages.get(i.instanceId, i.chatId, i.messageId, { channelId: i.channelId })
    ),
  mutators: {}
});

export let useChatMessage = (
  instanceId: string | null | undefined,
  chatId: string | null | undefined,
  messageId: string | null | undefined,
  channelId: string | null | undefined
) =>
  chatMessageLoader.use(
    instanceId && chatId && messageId && channelId
      ? { instanceId, chatId, messageId, channelId }
      : null
  );

export type ChatMessageCreateResult = DashboardInstanceChatsMessagesGetOutput;

export let useCreateChatMessage = chatMessagesLoader.createExternalMutator(
  (i: { instanceId: string; chatId: string } & DashboardInstanceChatsMessagesCreateBody) => {
    let { instanceId, chatId, ...body } = i;
    return withAuth(sdk => sdk.chat.messages.create(instanceId, chatId, body));
  }
);

export let useDeleteChatMessage = chatMessagesLoader.createExternalMutator(
  (i: { instanceId: string; chatId: string; messageId: string; channelId: string }) =>
    withAuth(sdk =>
      sdk.chat.messages.delete(i.instanceId, i.chatId, i.messageId, { channelId: i.channelId })
    )
);

export let useCreateChatMessageReaction = chatMessagesLoader.createExternalMutator(
  (
    i: {
      instanceId: string;
      chatId: string;
      messageId: string;
    } & DashboardInstanceChatsMessagesReactionsCreateBody
  ) => {
    let { instanceId, chatId, messageId, ...body } = i;
    return withAuth(sdk =>
      sdk.chat.messages.reactions.create(instanceId, chatId, messageId, body)
    );
  }
);

export let useDeleteChatMessageReaction = chatMessagesLoader.createExternalMutator(
  (
    i: {
      instanceId: string;
      chatId: string;
      messageId: string;
    } & DashboardInstanceChatsMessagesReactionsDeleteQuery
  ) => {
    let { instanceId, chatId, messageId, ...query } = i;
    return withAuth(sdk =>
      sdk.chat.messages.reactions.delete(instanceId, chatId, messageId, query)
    );
  }
);

export let chatThreadsLoader = createLoader({
  name: 'chatThreads',
  parents: [chatChannelLoader],
  fetch: (
    i: { instanceId: string; chatId: string } & DashboardInstanceChatsThreadsListQuery
  ) =>
    withAuth(sdk => {
      let { instanceId, chatId, ...query } = i;
      return sdk.chat.threads.list(instanceId, chatId, query);
    }),
  mutators: {}
});

export let useChatThreads = (
  instanceId: string | null | undefined,
  chatId: string | null | undefined,
  query: DashboardInstanceChatsThreadsListQuery | null | undefined
) =>
  usePaginator(
    pagination =>
      chatThreadsLoader.use(
        instanceId && chatId && query ? { instanceId, chatId, ...pagination, ...query } : null
      ),
    query ? `${chatId}:${query.channelId}` : null
  );

export let chatThreadLoader = createLoader({
  name: 'chatThread',
  parents: [chatThreadsLoader],
  fetch: (i: { instanceId: string; chatId: string; threadId: string; channelId: string }) =>
    withAuth(sdk =>
      sdk.chat.threads.get(i.instanceId, i.chatId, i.threadId, { channelId: i.channelId })
    ),
  mutators: {}
});

export let useChatThread = (
  instanceId: string | null | undefined,
  chatId: string | null | undefined,
  threadId: string | null | undefined,
  channelId: string | null | undefined
) =>
  chatThreadLoader.use(
    instanceId && chatId && threadId && channelId
      ? { instanceId, chatId, threadId, channelId }
      : null
  );
