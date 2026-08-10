import type { DashboardInstanceConversationsMessagesListQuery } from '@metorial/dashboard-sdk';
import {
  createClientReplica,
  type JsonValue,
  type WireMessage
} from '@metorial/product-assistant-client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { withAuth } from '../user';
import type {
  AssistantConversation,
  AssistantConversationMessage,
  AssistantLiveState,
  AssistantLiveStateItem
} from './loaders/assistant';
import {
  useAllConversationMessages,
  useConversation,
  useCreateConversationMessage
} from './loaders/assistant';

export type AssistantHistoryMessageQuery = Omit<
  DashboardInstanceConversationsMessagesListQuery,
  'after' | 'before' | 'cursor'
>;

export type AssistantConversationHistoryNode = {
  id: string;
  message: AssistantConversationMessage;
  parent: AssistantConversationHistoryNode | null;
  children: AssistantConversationHistoryNode[];
  siblings: AssistantConversationHistoryNode[];
  siblingIndex: number;
  previousSibling: AssistantConversationHistoryNode | null;
  nextSibling: AssistantConversationHistoryNode | null;
  depth: number;
  latestLeaf: AssistantConversationHistoryNode | null;
};

type AssistantSubmitMessageInput = {
  text: string;
  parentMessageId?: string | null;
  modelId?: string;
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

let isLiveItemRunning = (item: AssistantLiveStateItem) => {
  switch (item.type) {
    case 'tool':
      return item.calls.some(call => call.status == 'running');
    case 'files/explore':
      return item.operations.some(operation => operation.status == 'running');
    case 'web':
      return item.operations.some(operation => operation.status == 'running');
    case 'files/write':
    case 'shell':
    case 'message':
    case 'reasoning':
    case 'compaction':
      return item.status == 'running';
    case 'error':
      return false;
  }
};

let createOptimisticMessage = (d: {
  id: string;
  parentMessageId: string | null;
  text: string;
  createdAt: Date;
}): AssistantConversationMessage => {
  let items = [
    {
      id: `${d.id}:message`,
      type: 'message',
      status: 'completed',
      message: {
        role: 'user',
        parts: [{ type: 'text', text: d.text }]
      }
    }
  ];

  return {
    object: 'assistant.message',
    id: d.id,
    conversationItemId: d.id,
    type: 'user',
    status: 'completed',
    assistantId: null,
    parentMessageId: d.parentMessageId,
    model: null,
    request: {
      object: 'assistant.request',
      id: `optimistic-request:${d.id}`,
      status: 'completed',
      actor: null,
      actorId: null,
      createdAt: d.createdAt,
      updatedAt: d.createdAt
    },
    items,
    createdAt: d.createdAt
  } as AssistantConversationMessage;
};

let buildHistoryTree = (d: {
  messages: AssistantConversationMessage[];
  conversation: AssistantConversation | null | undefined;
}) => {
  let flatMessages = [...d.messages].sort(
    (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
  );
  let reverseMessages = [...flatMessages].reverse();
  let nodesById = new Map<string, AssistantConversationHistoryNode>();

  for (let message of reverseMessages) {
    nodesById.set(message.id, {
      id: message.id,
      message,
      parent: null,
      children: [],
      siblings: [],
      siblingIndex: 0,
      previousSibling: null,
      nextSibling: null,
      depth: 0,
      latestLeaf: null
    });
  }

  let roots: AssistantConversationHistoryNode[] = [];

  for (let message of reverseMessages) {
    let node = nodesById.get(message.id);
    if (!node) continue;

    let parentNode = message.parentMessageId
      ? (nodesById.get(message.parentMessageId) ?? null)
      : null;

    if (parentNode) {
      node.parent = parentNode;
      parentNode.children.unshift(node);
      continue;
    }

    roots.unshift(node);
  }

  let assignRelations = (
    siblings: AssistantConversationHistoryNode[],
    parent: AssistantConversationHistoryNode | null,
    depth: number
  ) => {
    for (let [index, node] of siblings.entries()) {
      node.parent = parent;
      node.siblings = siblings;
      node.siblingIndex = index;
      node.previousSibling = siblings[index - 1] ?? null;
      node.nextSibling = siblings[index + 1] ?? null;
      node.depth = depth;
      assignRelations(node.children, node, depth + 1);
    }
  };

  let assignLatestLeaf = (
    node: AssistantConversationHistoryNode
  ): AssistantConversationHistoryNode => {
    if (!node.children.length) {
      node.latestLeaf = node;
      return node;
    }

    let latestChild = node.children[node.children.length - 1]!;
    node.latestLeaf = assignLatestLeaf(latestChild);
    return node.latestLeaf;
  };

  assignRelations(roots, null, 0);

  for (let root of roots) {
    assignLatestLeaf(root);
  }

  let conversationRootMessageId = d.conversation?.rootMessageId ?? null;
  let rootMessage =
    (conversationRootMessageId
      ? flatMessages.find(message => message.id == conversationRootMessageId)
      : null) ??
    flatMessages.find(message => message.type == 'root') ??
    roots[0]?.message ??
    null;

  let rootNode = rootMessage ? (nodesById.get(rootMessage.id) ?? null) : null;
  let fallbackLatestMessage = flatMessages[flatMessages.length - 1] ?? null;
  let latestNode =
    rootNode?.latestLeaf ??
    roots[roots.length - 1]?.latestLeaf ??
    (fallbackLatestMessage ? (nodesById.get(fallbackLatestMessage.id) ?? null) : null);

  return {
    flatMessages,
    roots,
    nodesById,
    rootMessage,
    rootNode,
    latestNode,
    latestMessage: latestNode?.message ?? null,
    pendingRequest: getPendingRequest(flatMessages)
  };
};

let getPathToNode = (node: AssistantConversationHistoryNode | null) => {
  if (!node) return [] as AssistantConversationHistoryNode[];

  let path: AssistantConversationHistoryNode[] = [];
  let current: AssistantConversationHistoryNode | null = node;

  while (current) {
    path.unshift(current);
    current = current.parent;
  }

  return path;
};

let getLatestDescendantPath = (node: AssistantConversationHistoryNode | null) => {
  if (!node) return [] as AssistantConversationHistoryNode[];

  let path: AssistantConversationHistoryNode[] = [];
  let current = node.children[node.children.length - 1] ?? null;

  while (current) {
    path.push(current);
    current = current.children[current.children.length - 1] ?? null;
  }

  return path;
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
  let createMessage = useCreateConversationMessage();

  usePollingRefetch(
    conversation.refetch,
    opts?.conversationPollingIntervalMs ?? opts?.pollingIntervalMs,
    !!organizationId && !!instanceId && !!assistantConversationId
  );

  let conversationRefetchRef = useRef(conversation.refetch);
  let messagesRefetchRef = useRef(allMessages.refetch);
  conversationRefetchRef.current = conversation.refetch;
  messagesRefetchRef.current = allMessages.refetch;

  let [localMessages, setLocalMessages] = useState<AssistantConversationMessage[]>([]);
  let [referenceMessageId, setReferenceMessageId] = useState<string | null>(null);
  let referenceMessageIdRef = useRef<string | null>(null);
  referenceMessageIdRef.current = referenceMessageId;

  let [localStreamRequestId, setLocalStreamRequestId] = useState<string | null>(null);
  let [settledRequestId, setSettledRequestId] = useState<string | null>(null);
  let [isCreatingMessage, setIsCreatingMessage] = useState(false);
  let [submitError, setSubmitError] = useState<string | null>(null);

  let [liveState, setLiveState] = useState<AssistantLiveState | null>(null);
  let [liveSnapshotIndex, setLiveSnapshotIndex] = useState<number | null>(null);
  let [streamStatus, setStreamStatus] = useState<
    'idle' | 'connecting' | 'streaming' | 'error'
  >('idle');
  let [streamError, setStreamError] = useState<string | null>(null);
  let lastEventIdRef = useRef<string | undefined>(undefined);
  let previousRequestIdRef = useRef<string | null>(null);
  let previousStreamScopeRef = useRef<string | null>(null);

  useEffect(() => {
    let persistedIds = new Set((allMessages.data ?? []).map(message => message.id));
    if (!persistedIds.size) return;

    setLocalMessages(current => current.filter(message => !persistedIds.has(message.id)));
  }, [allMessages.data]);

  let mergedMessages = useMemo(() => {
    let persistedMessages = allMessages.data ?? [];
    let persistedIds = new Set(persistedMessages.map(message => message.id));
    let retainedLocalMessages = localMessages.filter(message => !persistedIds.has(message.id));

    return [...persistedMessages, ...retainedLocalMessages].sort(
      (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
    );
  }, [allMessages.data, localMessages]);

  let history = useMemo(
    () =>
      buildHistoryTree({
        messages: mergedMessages,
        conversation: conversation.data
      }),
    [conversation.data, mergedMessages]
  );

  let setReferenceMessage = useCallback(
    (messageId: string | null | undefined) => {
      if (!messageId) {
        setReferenceMessageId(history.latestNode?.id ?? null);
        return;
      }

      setReferenceMessageId(
        history.nodesById.has(messageId) ? messageId : (history.latestNode?.id ?? null)
      );
    },
    [history.latestNode?.id, history.nodesById]
  );

  let selectedReferenceNode = useMemo(() => {
    let desiredNode = referenceMessageId
      ? (history.nodesById.get(referenceMessageId) ?? null)
      : history.latestNode;

    return desiredNode ?? history.latestNode ?? null;
  }, [history.latestNode, history.nodesById, referenceMessageId]);

  useEffect(() => {
    if (!referenceMessageId && history.latestNode?.id) {
      setReferenceMessageId(history.latestNode.id);
      return;
    }

    if (referenceMessageId && !history.nodesById.has(referenceMessageId)) {
      setReferenceMessageId(history.latestNode?.id ?? null);
    }
  }, [history.latestNode?.id, history.nodesById, referenceMessageId]);

  let referenceNode = useMemo(
    () =>
      selectedReferenceNode?.latestLeaf ?? selectedReferenceNode ?? history.latestNode ?? null,
    [history.latestNode, selectedReferenceNode]
  );

  let currentPath = useMemo(() => {
    if (!selectedReferenceNode) return [] as AssistantConversationHistoryNode[];

    return [
      ...getPathToNode(selectedReferenceNode),
      ...getLatestDescendantPath(selectedReferenceNode)
    ];
  }, [selectedReferenceNode]);
  let currentMessages = useMemo(() => currentPath.map(node => node.message), [currentPath]);
  let currentNodesById = useMemo(
    () => new Map(currentPath.map(node => [node.id, node])),
    [currentPath]
  );

  let pendingRequest = history.pendingRequest;
  let unresolvedPendingRequest =
    pendingRequest?.id && pendingRequest.id != settledRequestId ? pendingRequest : null;
  let activeRequestId =
    localStreamRequestId ?? opts?.streamRequestId ?? unresolvedPendingRequest?.id ?? null;

  useEffect(() => {
    if (!pendingRequest?.id) {
      setSettledRequestId(null);
      return;
    }

    if (pendingRequest.id != settledRequestId) {
      setSettledRequestId(current => (current == pendingRequest.id ? current : null));
    }
  }, [pendingRequest?.id, settledRequestId]);

  useEffect(() => {
    if (!localStreamRequestId) return;
    if (unresolvedPendingRequest?.id == localStreamRequestId) {
      setLocalStreamRequestId(null);
      return;
    }

    let requestStatus = history.flatMessages.find(
      message => message.request?.id == localStreamRequestId
    )?.request.status;

    if (requestStatus && requestStatus != 'pending') {
      setLocalStreamRequestId(null);
    }
  }, [history.flatMessages, localStreamRequestId, unresolvedPendingRequest?.id]);

  useEffect(() => {
    let streamScope =
      organizationId && instanceId && assistantConversationId
        ? `${organizationId}:${instanceId}:${assistantConversationId}`
        : null;

    if (previousStreamScopeRef.current != streamScope) {
      previousStreamScopeRef.current = streamScope;
      setLiveState(null);
      setLiveSnapshotIndex(null);
    }

    if (previousRequestIdRef.current != activeRequestId) {
      lastEventIdRef.current = undefined;
      previousRequestIdRef.current = activeRequestId;

      if (activeRequestId) {
        setLiveState(null);
        setLiveSnapshotIndex(null);
      }
    }

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
          setLocalStreamRequestId(null);
          setSettledRequestId(activeRequestId);
          setStreamStatus('idle');
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

  let submitMessage = useCallback(
    async (input: AssistantSubmitMessageInput) => {
      if (!organizationId || !instanceId || !assistantConversationId) {
        throw new Error('Missing assistant conversation scope.');
      }

      let text = input.text.trim();
      if (!text) return null;

      let createdAt = new Date();
      let optimisticId = `optimistic-message:${createdAt.getTime()}:${Math.random()
        .toString(36)
        .slice(2, 10)}`;
      let fallbackParentMessageId =
        input.parentMessageId ?? referenceNode?.id ?? conversation.data?.rootMessageId ?? null;
      let optimisticMessage = createOptimisticMessage({
        id: optimisticId,
        parentMessageId: fallbackParentMessageId,
        text,
        createdAt
      });
      let previousReferenceId = referenceMessageIdRef.current;

      setSubmitError(null);
      setIsCreatingMessage(true);
      setLocalMessages(current => [...current, optimisticMessage]);
      setReferenceMessageId(optimisticId);

      try {
        let [createdMessage] = await createMessage.mutate({
          organizationId,
          instanceId,
          assistantConversationId,
          parentMessageId: fallbackParentMessageId ?? undefined,
          modelId: input.modelId,
          message: {
            parts: [{ type: 'text', text }]
          }
        });

        setLocalMessages(current => {
          let next = current.filter(message => message.id != optimisticId);
          if (createdMessage) next.push(createdMessage);
          return next;
        });

        if (createdMessage?.request?.status == 'pending') {
          setSettledRequestId(null);
          setLocalStreamRequestId(createdMessage.request.id);
        }

        setReferenceMessageId(createdMessage?.id ?? previousReferenceId ?? null);
        conversationRefetchRef.current?.();
        messagesRefetchRef.current?.();

        return createdMessage ?? null;
      } catch (error) {
        setLocalMessages(current => current.filter(message => message.id != optimisticId));
        setReferenceMessageId(current =>
          current == optimisticId ? (previousReferenceId ?? null) : current
        );
        setSubmitError(getErrorMessage(error));
        throw error;
      } finally {
        setIsCreatingMessage(false);
      }
    },
    [
      assistantConversationId,
      conversation.data?.rootMessageId,
      createMessage,
      instanceId,
      organizationId,
      referenceNode?.id
    ]
  );

  let liveItems = liveState?.items ?? [];
  let hasRunningLiveItems = liveItems.some(isLiveItemRunning);
  let isWaitingForResponse = !!activeRequestId && liveItems.length === 0;
  let isAssistantBusy =
    isWaitingForResponse || streamStatus == 'connecting' || hasRunningLiveItems;
  let isAssistantReady = !isAssistantBusy;

  return {
    conversation,
    messages: allMessages,
    data: history.rootNode,
    flatMessages: history.flatMessages,
    roots: history.roots,
    rootMessage: history.rootMessage,
    rootNode: history.rootNode,
    latestMessage: history.latestMessage,
    pendingRequest,
    activeRequestId,
    nodesById: history.nodesById,
    currentNodesById,
    currentPath,
    currentMessages,
    referenceMessage: referenceNode?.message ?? null,
    referenceNode,
    referenceMessageId: referenceNode?.id ?? null,
    setReferenceMessage,
    submitMessage,
    isCreatingMessage,
    submitError,
    liveState,
    liveItems,
    liveSnapshotIndex,
    streamStatus,
    streamError,
    isWaitingForResponse,
    isAssistantBusy,
    isAssistantReady,
    refetch: () => {
      conversation.refetch();
      allMessages.refetch();
    },
    error: conversation.error ?? allMessages.error,
    isLoading: conversation.isLoading || allMessages.isLoading
  };
};
