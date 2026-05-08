import type {
  DashboardOrganizationsAssistantsGetOutput,
  DashboardOrganizationsAssistantsListQuery,
  DashboardOrganizationsConversationsCreateBody,
  DashboardOrganizationsConversationsGetOutput,
  DashboardOrganizationsConversationsListQuery,
  DashboardOrganizationsConversationsMessagesCreateBody,
  DashboardOrganizationsConversationsMessagesGetOutput,
  DashboardOrganizationsConversationsMessagesListQuery
} from '@metorial/dashboard-sdk';
import { createLoader } from '@metorial/data-hooks';
import type {
  State as AssistantRunState,
  StateItem as AssistantRunStateItem
} from '@metorial/module-assistant/src/proto/types';
import { useEffect } from 'react';
import { autoPaginate } from '../../lib/autoPaginate';
import { usePaginator } from '../../lib/usePaginator';
import { withAuth } from '../../user';

export type Assistant = DashboardOrganizationsAssistantsGetOutput;
export type AssistantConversation = DashboardOrganizationsConversationsGetOutput;
export type AssistantConversationMessage =
  DashboardOrganizationsConversationsMessagesGetOutput;
export type AssistantLiveState = AssistantRunState;
export type AssistantLiveStateItem = AssistantRunStateItem;

export let defaultAssistantSlug = 'skills';

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
  fetch: (i: AssistantScope & DashboardOrganizationsAssistantsListQuery) =>
    withAuth(sdk => sdk.assistant.assistants.list(i.organizationId, i.instanceId, i)),
  mutators: {}
});

export let useAssistants = (
  organizationId: string | null | undefined,
  instanceId: string | null | undefined,
  query?: DashboardOrganizationsAssistantsListQuery | null
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
    withAuth(sdk =>
      sdk.assistant.assistants.get(i.organizationId, i.instanceId, i.assistantId)
    ),
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
  fetch: (i: AssistantScope & DashboardOrganizationsConversationsListQuery) =>
    withAuth(sdk => sdk.assistant.conversations.list(i.organizationId, i.instanceId, i)),
  mutators: {}
});

export let useConversations = (
  organizationId: string | null | undefined,
  instanceId: string | null | undefined,
  query?: DashboardOrganizationsConversationsListQuery | null
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
  (i: DashboardOrganizationsConversationsCreateBody & AssistantScope) =>
    withAuth(sdk => sdk.assistant.conversations.create(i.organizationId, i.instanceId, i)),
  {
    disableToast: true
  }
);

export let conversationLoader = createLoader({
  name: 'assistantConversation',
  parents: [conversationsLoader],
  fetch: (i: ConversationScope) =>
    withAuth(sdk =>
      sdk.assistant.conversations.get(
        i.organizationId,
        i.instanceId,
        i.assistantConversationId
      )
    ),
  mutators: {}
});

export let useConversation = (
  organizationId: string | null | undefined,
  instanceId: string | null | undefined,
  assistantConversationId: string | null | undefined
) => {
  return conversationLoader.use(
    organizationId && instanceId && assistantConversationId
      ? {
          organizationId,
          instanceId,
          assistantConversationId
        }
      : null
  );
};

export let conversationMessagesLoader = createLoader({
  name: 'assistantConversationMessages',
  parents: [conversationLoader],
  fetch: (i: ConversationScope & DashboardOrganizationsConversationsMessagesListQuery) =>
    withAuth(sdk =>
      sdk.assistant.conversations.messages.list(
        i.organizationId,
        i.instanceId,
        i.assistantConversationId,
        i
      )
    ),
  mutators: {}
});

export let useConversationMessages = (
  organizationId: string | null | undefined,
  instanceId: string | null | undefined,
  assistantConversationId: string | null | undefined,
  query?: DashboardOrganizationsConversationsMessagesListQuery | null
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
        i.organizationId,
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
  (i: DashboardOrganizationsConversationsMessagesCreateBody & ConversationScope) =>
    withAuth(sdk =>
      sdk.assistant.conversations.messages.create(
        i.organizationId,
        i.instanceId,
        i.assistantConversationId,
        i
      )
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
      Omit<DashboardOrganizationsConversationsMessagesListQuery, 'after' | 'before' | 'cursor'>
  ) =>
    withAuth(sdk =>
      autoPaginate(cursor =>
        sdk.assistant.conversations.messages.list(
          i.organizationId,
          i.instanceId,
          i.assistantConversationId,
          {
            ...i,
            ...cursor,
            limit: i.limit ?? 100,
            order: i.order ?? 'asc'
          }
        )
      )
    ),
  mutators: {}
});

export let useAllConversationMessages = (
  organizationId: string | null | undefined,
  instanceId: string | null | undefined,
  assistantConversationId: string | null | undefined,
  query?: Omit<
    DashboardOrganizationsConversationsMessagesListQuery,
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
