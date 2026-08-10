import type {
  State as AssistantRunState,
  StateItem as AssistantRunStateItem
} from '@metorial/product-assistant-client';
import type {
  DashboardInstanceAssistantsGetOutput,
  DashboardInstanceAssistantsListQuery,
  DashboardInstanceConversationsCreateBody,
  DashboardInstanceConversationsGetOutput,
  DashboardInstanceConversationsListQuery,
  DashboardInstanceConversationsUpdateBody,
  DashboardInstanceConversationsMessagesCreateBody,
  DashboardInstanceConversationsMessagesGetOutput,
  DashboardInstanceConversationsMessagesListQuery
} from '@metorial/dashboard-sdk';
import { createLoader } from '@metorial/data-hooks';
import { useEffect } from 'react';
import { autoPaginate } from '../../lib/autoPaginate';
import { usePaginator } from '../../lib/usePaginator';
import { withAuth } from '../../user';

export type Assistant = DashboardInstanceAssistantsGetOutput;
export type AssistantConversation = DashboardInstanceConversationsGetOutput;
export type AssistantConversationMessage = DashboardInstanceConversationsMessagesGetOutput;
export type AssistantLiveState = AssistantRunState;
export type AssistantLiveStateItem = AssistantRunStateItem;

export let metorialAssistantSlug = 'test';
export let defaultAssistantSlug = metorialAssistantSlug;

type AssistantScope = {
  organizationId: string;
  instanceId: string;
};

type ConversationScope = AssistantScope & {
  assistantConversationId: string;
};

type PollingOptions = {
  pollingIntervalMs?: number | null;
};

let usePollingRefetch = (
  refetch: (() => void) | undefined,
  pollingIntervalMs?: number | null,
  enabled: boolean = true
) => {
  useEffect(() => {
    if (!enabled || !refetch || !pollingIntervalMs || pollingIntervalMs <= 0) return;

    let interval = setInterval(() => {
      refetch();
    }, pollingIntervalMs);

    return () => clearInterval(interval);
  }, [enabled, pollingIntervalMs, refetch]);
};

export let assistantsLoader = createLoader({
  name: 'assistants',
  parents: [],
  fetch: (i: AssistantScope & DashboardInstanceAssistantsListQuery) =>
    withAuth(sdk => sdk.assistant.assistants.list(i.instanceId, i)),
  mutators: {}
});

export let useAssistants = (
  organizationId: string | null | undefined,
  instanceId: string | null | undefined,
  query?: DashboardInstanceAssistantsListQuery | null
) => {
  return usePaginator(
    pagination =>
      assistantsLoader.use(
        organizationId && instanceId && query !== null
          ? {
              organizationId,
              instanceId,
              ...pagination,
              ...(query ?? {})
            }
          : null
      ),
    organizationId && instanceId ? `${organizationId}:${instanceId}` : null
  );
};

export let assistantLoader = createLoader({
  name: 'assistant',
  parents: [assistantsLoader],
  fetch: (i: AssistantScope & { assistantId: string }) =>
    withAuth(sdk => sdk.assistant.assistants.get(i.instanceId, i.assistantId)),
  mutators: {}
});

export let useAssistant = (
  organizationId: string | null | undefined,
  instanceId: string | null | undefined,
  assistantId: string | null | undefined
) => {
  return assistantLoader.use(
    organizationId && instanceId && assistantId
      ? {
          organizationId,
          instanceId,
          assistantId
        }
      : null
  );
};

export let useFixedAssistant = (
  organizationId: string | null | undefined,
  instanceId: string | null | undefined,
  assistantSlug?: string | null
) => {
  return useAssistant(organizationId, instanceId, assistantSlug ?? defaultAssistantSlug);
};

export let conversationsLoader = createLoader({
  name: 'assistantConversations',
  parents: [],
  fetch: (i: AssistantScope & DashboardInstanceConversationsListQuery) =>
    withAuth(sdk => sdk.assistant.conversations.list(i.instanceId, i)),
  mutators: {}
});

export let useConversations = (
  organizationId: string | null | undefined,
  instanceId: string | null | undefined,
  query?: DashboardInstanceConversationsListQuery | null
) => {
  return usePaginator(
    pagination =>
      conversationsLoader.use(
        organizationId && instanceId && query !== null
          ? {
              organizationId,
              instanceId,
              ...pagination,
              ...(query ?? {})
            }
          : null
      ),
    organizationId && instanceId ? `${organizationId}:${instanceId}` : null
  );
};

export let useCreateConversation = conversationsLoader.createExternalMutator(
  (i: DashboardInstanceConversationsCreateBody & AssistantScope) =>
    withAuth(sdk => sdk.assistant.conversations.create(i.instanceId, i)),
  {
    disableToast: true
  }
);

export let conversationLoader = createLoader({
  name: 'assistantConversation',
  parents: [conversationsLoader],
  fetch: (i: ConversationScope) =>
    withAuth(sdk => sdk.assistant.conversations.get(i.instanceId, i.assistantConversationId)),
  mutators: {
    update: (i: DashboardInstanceConversationsUpdateBody, { output: { id, instanceId } }) =>
      withAuth(sdk => sdk.assistant.conversations.update(instanceId, id, i))
  }
});

export let useConversation = (
  organizationId: string | null | undefined,
  instanceId: string | null | undefined,
  assistantConversationId: string | null | undefined
) => {
  let conversation = conversationLoader.use(
    organizationId && instanceId && assistantConversationId
      ? {
          organizationId,
          instanceId,
          assistantConversationId
        }
      : null
  );

  return {
    ...conversation,
    updateMutator: conversation.useMutator('update')
  };
};

export let conversationMessagesLoader = createLoader({
  name: 'assistantConversationMessages',
  parents: [conversationLoader],
  fetch: (i: ConversationScope & DashboardInstanceConversationsMessagesListQuery) =>
    withAuth(sdk =>
      sdk.assistant.conversations.messages.list(i.instanceId, i.assistantConversationId, i)
    ),
  mutators: {}
});

export let useConversationMessages = (
  organizationId: string | null | undefined,
  instanceId: string | null | undefined,
  assistantConversationId: string | null | undefined,
  query?: DashboardInstanceConversationsMessagesListQuery | null
) => {
  return usePaginator(
    pagination =>
      conversationMessagesLoader.use(
        organizationId && instanceId && assistantConversationId && query !== null
          ? {
              organizationId,
              instanceId,
              assistantConversationId,
              ...pagination,
              ...(query ?? {})
            }
          : null
      ),
    organizationId && instanceId && assistantConversationId
      ? `${organizationId}:${instanceId}:${assistantConversationId}`
      : null
  );
};

export let conversationMessageLoader = createLoader({
  name: 'assistantConversationMessage',
  parents: [conversationMessagesLoader],
  fetch: (i: ConversationScope & { assistantMessageId: string }) =>
    withAuth(sdk =>
      sdk.assistant.conversations.messages.get(
        i.instanceId,
        i.assistantConversationId,
        i.assistantMessageId
      )
    ),
  mutators: {}
});

export let useConversationMessage = (
  organizationId: string | null | undefined,
  instanceId: string | null | undefined,
  assistantConversationId: string | null | undefined,
  assistantMessageId: string | null | undefined
) => {
  return conversationMessageLoader.use(
    organizationId && instanceId && assistantConversationId && assistantMessageId
      ? {
          organizationId,
          instanceId,
          assistantConversationId,
          assistantMessageId
        }
      : null
  );
};

export let useCreateConversationMessage = conversationMessagesLoader.createExternalMutator(
  (i: DashboardInstanceConversationsMessagesCreateBody & ConversationScope) =>
    withAuth(sdk =>
      sdk.assistant.conversations.messages.create(i.instanceId, i.assistantConversationId, i)
    ),
  {
    disableToast: true
  }
);

export let allConversationMessagesLoader = createLoader({
  name: 'allAssistantConversationMessages',
  parents: [conversationLoader, conversationMessagesLoader],
  fetch: (
    i: ConversationScope &
      Omit<DashboardInstanceConversationsMessagesListQuery, 'after' | 'before' | 'cursor'>
  ) =>
    withAuth(sdk =>
      autoPaginate(cursor =>
        sdk.assistant.conversations.messages.list(i.instanceId, i.assistantConversationId, {
          ...i,
          ...cursor,
          limit: i.limit ?? 100,
          order: i.order ?? 'asc'
        })
      )
    ),
  mutators: {}
});

export let useAllConversationMessages = (
  organizationId: string | null | undefined,
  instanceId: string | null | undefined,
  assistantConversationId: string | null | undefined,
  query?: Omit<
    DashboardInstanceConversationsMessagesListQuery,
    'after' | 'before' | 'cursor'
  > &
    PollingOptions
) => {
  let { pollingIntervalMs, ...messageQuery } = query ?? {};

  let data = allConversationMessagesLoader.use(
    organizationId && instanceId && assistantConversationId
      ? {
          organizationId,
          instanceId,
          assistantConversationId,
          ...messageQuery
        }
      : null
  );

  usePollingRefetch(
    data.refetch,
    pollingIntervalMs,
    !!organizationId && !!instanceId && !!assistantConversationId
  );

  return data;
};
