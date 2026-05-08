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
import { createClientReplica } from '@metorial/module-assistant/src/lib/delta/client';
import type { JsonValue, WireMessage } from '@metorial/module-assistant/src/lib/delta/types';
import type {
  State as AssistantRunState,
  StateItem as AssistantRunStateItem
} from '@metorial/module-assistant/src/proto/types';
import { useEffect, useMemo, useRef, useState } from 'react';
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

export type AssistantConversationHistoryNode = {
  id: string;
  message: AssistantConversationMessage;
  parent: AssistantConversationHistoryNode | null;
  children: AssistantConversationHistoryNode[];
  depth: number;
};

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

type AssistantHistoryMessageQuery = Omit<
  DashboardOrganizationsConversationsMessagesListQuery,
  'after' | 'before' | 'cursor'
>;

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

let getPendingRequest = (
  messages: AssistantConversationMessage[]
): AssistantConversationMessage['request'] | null => {
  for (let i = messages.length - 1; i >= 0; i--) {
    let request = messages[i]?.request;
    if (request?.status == 'pending') return request;
  }

  return null;
};

let getErrorMessage = (error: unknown) => {
  if (error instanceof Error) return error.message;
  if (typeof error == 'string') return error;
  return 'Unknown assistant stream error';
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

let sortHistoryNodes = (nodes: AssistantConversationHistoryNode[]) => {
  nodes.sort((a, b) => a.message.createdAt.getTime() - b.message.createdAt.getTime());

  for (let node of nodes) {
    if (node.children.length) sortHistoryNodes(node.children);
  }
};

let assignDepths = (node: AssistantConversationHistoryNode, depth: number) => {
  node.depth = depth;
  for (let child of node.children) {
    assignDepths(child, depth + 1);
  }
};

export let useConversationHistory = (
  organizationId: string | null | undefined,
  instanceId: string | null | undefined,
  assistantConversationId: string | null | undefined,
  opts?: {
    pollingIntervalMs?: number | null;
    conversationPollingIntervalMs?: number | null;
    messageQuery?: AssistantHistoryMessageQuery;
    streamRequestId?: string | null;
  }
) => {
  let conversation = useConversation(organizationId, instanceId, assistantConversationId);
  let allMessages = useAllConversationMessages(
    organizationId,
    instanceId,
    assistantConversationId,
    {
      ...(opts?.messageQuery ?? {}),
      pollingIntervalMs: opts?.pollingIntervalMs
    }
  );

  usePollingRefetch(
    conversation.refetch,
    opts?.conversationPollingIntervalMs ?? opts?.pollingIntervalMs,
    !!organizationId && !!instanceId && !!assistantConversationId
  );

  let conversationRefetchRef = useRef(conversation.refetch);
  let messagesRefetchRef = useRef(allMessages.refetch);
  conversationRefetchRef.current = conversation.refetch;
  messagesRefetchRef.current = allMessages.refetch;

  let [liveState, setLiveState] = useState<AssistantLiveState | null>(null);
  let [liveSnapshotIndex, setLiveSnapshotIndex] = useState<number | null>(null);
  let [streamStatus, setStreamStatus] = useState<
    'idle' | 'connecting' | 'streaming' | 'error'
  >('idle');
  let [streamError, setStreamError] = useState<string | null>(null);
  let lastEventIdRef = useRef<string | undefined>(undefined);
  let previousRequestIdRef = useRef<string | null>(null);

  let history = useMemo(() => {
    let flatMessages = [...(allMessages.data ?? [])].sort(
      (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
    );
    let nodesById = new Map<string, AssistantConversationHistoryNode>();

    for (let message of flatMessages) {
      nodesById.set(message.id, {
        id: message.id,
        message,
        parent: null,
        children: [],
        depth: 0
      });
    }

    let roots: AssistantConversationHistoryNode[] = [];
    for (let message of flatMessages) {
      let node = nodesById.get(message.id)!;
      let parentNode = message.parentMessageId
        ? (nodesById.get(message.parentMessageId) ?? null)
        : null;

      if (parentNode) {
        node.parent = parentNode;
        parentNode.children.push(node);
      } else {
        roots.push(node);
      }
    }

    sortHistoryNodes(roots);
    for (let root of roots) {
      assignDepths(root, 0);
    }

    let rootMessage =
      (conversation.data?.rootMessageId
        ? flatMessages.find(message => message.id == conversation.data?.rootMessageId)
        : null) ??
      flatMessages.find(message => message.type == 'root') ??
      null;
    let rootNode = rootMessage ? (nodesById.get(rootMessage.id) ?? null) : null;
    let latestMessage = flatMessages[flatMessages.length - 1] ?? null;
    let pendingRequest = getPendingRequest(flatMessages);

    return {
      flatMessages,
      roots,
      nodesById,
      rootMessage,
      rootNode,
      latestMessage,
      pendingRequest
    };
  }, [allMessages.data, conversation.data?.rootMessageId]);

  let activeRequestId = history.pendingRequest?.id ?? opts?.streamRequestId ?? null;

  useEffect(() => {
    if (previousRequestIdRef.current != activeRequestId) {
      lastEventIdRef.current = undefined;
      previousRequestIdRef.current = activeRequestId;
    }

    setLiveState(null);
    setLiveSnapshotIndex(null);
    setStreamError(null);

    if (!organizationId || !instanceId || !assistantConversationId || !activeRequestId) {
      setStreamStatus('idle');
      return;
    }

    let disposed = false;
    let closeConnection: (() => void) | undefined;
    let replica = createClientReplica<JsonValue>({
      initial: { items: [] },
      onChange: (state, meta) => {
        if (disposed) return;
        setLiveState(state as unknown as AssistantLiveState);
        setLiveSnapshotIndex(meta.index);
        setStreamStatus('streaming');
      },
      onSnapshotRequired: () => {
        if (disposed) return;
        conversationRefetchRef.current();
        messagesRefetchRef.current();
      }
    });

    setStreamStatus('connecting');

    void withAuth(async sdk => {
      if (disposed) return;

      let connection = sdk.assistant.connectRequestDeltas(activeRequestId, {
        lastEventId: lastEventIdRef.current,
        onEvent: async event => {
          if (disposed) return;
          if (event.id) lastEventIdRef.current = event.id;
        },
        onSnapshot: async event => {
          if (disposed || !Array.isArray(event.data)) return;
          replica.receive(event.data as WireMessage<JsonValue>);
        },
        onDelta: async event => {
          if (disposed || !Array.isArray(event.data)) return;
          replica.receive(event.data as WireMessage<JsonValue>);
        },
        onError: async event => {
          if (disposed) return;
          setStreamStatus('error');
          setStreamError(getErrorMessage(event.data));
        },
        onClose: async () => {
          if (disposed) return;
          conversationRefetchRef.current();
          messagesRefetchRef.current();
        }
      });

      closeConnection = connection.close;

      try {
        await connection.done;
      } catch (error) {
        if (disposed) return;
        setStreamStatus('error');
        setStreamError(getErrorMessage(error));
      }
    }).catch(error => {
      if (disposed) return;
      setStreamStatus('error');
      setStreamError(getErrorMessage(error));
    });

    return () => {
      disposed = true;
      closeConnection?.();
    };
  }, [activeRequestId, assistantConversationId, instanceId, organizationId]);

  let liveItems = liveState?.items ?? [];
  let isWaitingForResponse = !!activeRequestId && liveItems.length === 0;

  return {
    conversation,
    messages: allMessages,
    data: history.rootNode,
    flatMessages: history.flatMessages,
    roots: history.roots,
    rootMessage: history.rootMessage,
    rootNode: history.rootNode,
    latestMessage: history.latestMessage,
    pendingRequest: history.pendingRequest,
    activeRequestId,
    nodesById: history.nodesById,
    liveState,
    liveItems,
    liveSnapshotIndex,
    streamStatus,
    streamError,
    isWaitingForResponse,
    refetch: () => {
      conversation.refetch();
      allMessages.refetch();
    },
    error: conversation.error ?? allMessages.error,
    isLoading: conversation.isLoading || allMessages.isLoading
  };
};
