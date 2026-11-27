import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from 'react';
import { documentLoader, documentsLoader } from '../files/loaders/documents';
import {
  allStoreItemsLoader,
  storeItemLoader,
  storeItemsLoader,
  storeLoader
} from '../files/loaders/stores';
import { skillContentPreviewsLoader } from '../skills/loaders/skillContentPreviews';
import {
  allSkillItemsLoader,
  allSkillsLoader,
  skillAgentsLoader,
  skillItemLoader,
  skillItemsLoader,
  skillLoader,
  skillsLoader
} from '../skills/loaders/skills';
import { useMetorialAssistantEnabled } from './availability';
import { useConversationHistory } from './conversationHistory';
import {
  useCancelConversationMessage,
  useCreateConversation,
  type AssistantLiveStateItem
} from './loaders/assistant';

export let skillsAssistantSlug = 'skills';

export type SkillAssistantMode =
  'block' | 'rewrite' | 'summarize' | 'document' | 'skill' | 'metadata';

export type SkillAssistantRequestContext = {
  mode: SkillAssistantMode;
  documentId?: string;
  selection?: { from: string; to: string; text: string };
  blockRef?: string;
  target?: { type: 'selection' | 'section' | 'document'; ref?: string; text?: string };
  placement?: 'inline' | 'chat';
};

export type SkillAssistantDocumentEditItem = Extract<
  AssistantLiveStateItem,
  { type: 'document/edit' }
>;
export type SkillAssistantChangesItem = Extract<
  AssistantLiveStateItem,
  { type: 'skill/changes' }
>;

export type SkillAssistantRequestStatus =
  'idle' | 'sending' | 'running' | 'completed' | 'failed' | 'cancelled';

let ownedRequestsStorageKey = 'metorial:skill-agent:requests';
let maxOwnedRequests = 50;
let maxInitialGenerationMs = 10 * 60 * 1000;

let readOwnedRequests = () => {
  try {
    let parsed = JSON.parse(window.sessionStorage.getItem(ownedRequestsStorageKey) ?? '[]');
    return Array.isArray(parsed) ? (parsed as string[]) : [];
  } catch {
    return [];
  }
};

let rememberOwnedRequest = (requestId: string) => {
  let next = [requestId, ...readOwnedRequests().filter(id => id != requestId)].slice(
    0,
    maxOwnedRequests
  );

  try {
    window.sessionStorage.setItem(ownedRequestsStorageKey, JSON.stringify(next));
  } catch {}

  return next;
};

let queuedPromptStorageKey = (skillId: string) =>
  `metorial:skill-agent:queued-prompt:${skillId}`;

export let queueSkillAssistantPrompt = (skillId: string, text: string) => {
  try {
    window.sessionStorage.setItem(queuedPromptStorageKey(skillId), text);
  } catch {}
};

export let hasQueuedSkillAssistantPrompt = (skillId: string) => {
  try {
    return !!window.sessionStorage.getItem(queuedPromptStorageKey(skillId));
  } catch {
    return false;
  }
};

let reviewPendingStorageKey = (skillId: string) =>
  `metorial:skill-agent:review-after-generation:${skillId}`;

export let hasSkillAssistantReviewPending = (skillId: string) => {
  try {
    return window.sessionStorage.getItem(reviewPendingStorageKey(skillId)) == '1';
  } catch {
    return false;
  }
};

export let clearSkillAssistantReviewPending = (skillId: string) => {
  try {
    window.sessionStorage.removeItem(reviewPendingStorageKey(skillId));
  } catch {}
};

export let takeQueuedSkillAssistantPrompt = (skillId: string) => {
  try {
    let text = window.sessionStorage.getItem(queuedPromptStorageKey(skillId));
    window.sessionStorage.removeItem(queuedPromptStorageKey(skillId));
    if (text) window.sessionStorage.setItem(reviewPendingStorageKey(skillId), '1');
    return text || null;
  } catch {
    return null;
  }
};

let skillLoadersToRefresh = [
  storeLoader,
  storeItemsLoader,
  allStoreItemsLoader,
  storeItemLoader,
  documentLoader,
  documentsLoader,
  skillLoader,
  skillsLoader,
  allSkillsLoader,
  skillItemLoader,
  skillItemsLoader,
  allSkillItemsLoader,
  skillAgentsLoader,
  skillContentPreviewsLoader
];

export let refreshSkillStoreLoaders = () => {
  for (let loader of skillLoadersToRefresh) loader.refetchAll({ ignoreFocus: true });
};

let refreshSkillStoreLoadersStaggered = () => {
  refreshSkillStoreLoaders();
  for (let delay of [1000, 3000, 6000]) setTimeout(refreshSkillStoreLoaders, delay);
};

let getErrorMessage = (error: unknown) => {
  if (error instanceof Error) return error.message;
  if (typeof error == 'string') return error;
  return 'Something went wrong.';
};

export let useSkillAssistant = (d: {
  organizationId?: string | null;
  instanceId: string | null | undefined;
  skillId: string | null | undefined;
  documentId?: string | null;
  conversationId?: string | null;
  onConversationCreated?: (conversationId: string) => void;
}) => {
  let [createdConversationId, setCreatedConversationId] = useState<string | null>(null);
  let conversationId = d.conversationId ?? createdConversationId;
  let scopeId = d.organizationId ?? d.instanceId ?? null;

  let history = useConversationHistory(scopeId, d.instanceId, conversationId, {
    pollingIntervalMs: 3000
  });
  let createConversation = useCreateConversation();
  let cancelMessage = useCancelConversationMessage();

  let [ownedRequestIds, setOwnedRequestIds] = useState(() => new Set(readOwnedRequests()));
  let [isSending, setIsSending] = useState(false);
  let [sendError, setSendError] = useState<string | null>(null);
  let [lastRequestId, setLastRequestId] = useState<string | null>(null);
  let [liveRequestId, setLiveRequestId] = useState<string | null>(null);
  let [cancelledRequestId, setCancelledRequestId] = useState<string | null>(null);

  useEffect(() => {
    if (history.activeRequestId) setLiveRequestId(history.activeRequestId);
  }, [history.activeRequestId]);

  let isOwnedLiveState = !!liveRequestId && ownedRequestIds.has(liveRequestId);
  let liveItems = history.liveItems;

  let documentEdits = useMemo(
    () =>
      isOwnedLiveState
        ? liveItems.filter(
            (item): item is SkillAssistantDocumentEditItem => item.type == 'document/edit'
          )
        : [],
    [isOwnedLiveState, liveItems]
  );

  let changeSignature = liveItems
    .map(item => {
      if (item.type == 'skill/changes') return `${item.id}:${item.changes.length}`;
      if (item.type == 'files/write' || item.type == 'shell')
        return `${item.id}:${item.status}`;
      if (item.type == 'tool') {
        return `${item.id}:${item.calls.map(call => `${call.id}${call.status}`).join(',')}`;
      }
      return '';
    })
    .join('|');
  useEffect(() => {
    if (changeSignature.replace(/\|/g, '')) refreshSkillStoreLoadersStaggered();
  }, [changeSignature]);

  let requestStatusById = useMemo(() => {
    let statuses = new Map<string, string>();
    for (let message of history.flatMessages) {
      if (message.request?.id) statuses.set(message.request.id, message.request.status);
    }
    return statuses;
  }, [history.flatMessages]);

  let trackedRequestId = history.activeRequestId ?? lastRequestId;
  let trackedRequestStatus = trackedRequestId
    ? requestStatusById.get(trackedRequestId)
    : undefined;

  let isCancelledAndSettled =
    !!trackedRequestId &&
    trackedRequestId == cancelledRequestId &&
    !history.activeRequestId &&
    (!trackedRequestStatus || trackedRequestStatus == 'pending');

  let isTrackedRequestPending =
    !!trackedRequestId &&
    !isCancelledAndSettled &&
    (!trackedRequestStatus || trackedRequestStatus == 'pending');

  let refetchHistory = history.refetch;
  useEffect(() => {
    if (!cancelledRequestId || trackedRequestStatus != 'pending') return;

    let interval = setInterval(() => refetchHistory(), 1000);
    return () => clearInterval(interval);
  }, [cancelledRequestId, trackedRequestStatus, refetchHistory]);

  let status: SkillAssistantRequestStatus = isSending
    ? 'sending'
    : history.activeRequestId || history.isAssistantBusy || isTrackedRequestPending
      ? 'running'
      : trackedRequestStatus == 'failed'
        ? 'failed'
        : trackedRequestStatus == 'cancelled' || isCancelledAndSettled
          ? 'cancelled'
          : trackedRequestId
            ? 'completed'
            : 'idle';

  let wasRunningRef = useRef(false);
  let isRunning = status == 'running' || status == 'sending';
  useEffect(() => {
    if (wasRunningRef.current && !isRunning) refreshSkillStoreLoadersStaggered();
    wasRunningRef.current = isRunning;
  }, [isRunning]);

  let referenceMessage = history.referenceMessage;
  let defaultParentMessageId = !referenceMessage
    ? (history.conversation.data?.rootMessageId ?? null)
    : referenceMessage.type == 'assistant' || referenceMessage.type == 'root'
      ? referenceMessage.id
      : null;

  let send = useCallback(
    async (input: {
      text: string;
      context: SkillAssistantRequestContext;
      modelId?: string;
      parentMessageId?: string | null;
    }) => {
      if (!scopeId || !d.instanceId || !d.skillId) {
        throw new Error('The skill assistant is not available here.');
      }

      setIsSending(true);
      setSendError(null);

      try {
        let targetConversationId = conversationId;
        let parentMessageId = input.parentMessageId ?? defaultParentMessageId;

        if (!targetConversationId) {
          let [conversation, error] = await createConversation.mutate({
            organizationId: scopeId,
            instanceId: d.instanceId,
            assistantId: skillsAssistantSlug,
            input: {
              skillId: d.skillId,
              ...(d.documentId ? { documentId: d.documentId } : {})
            }
          });
          if (error || !conversation) {
            throw new Error(error?.data.message ?? 'Unable to start the skill assistant.');
          }

          targetConversationId = conversation.id;
          parentMessageId = conversation.rootMessageId;
          setCreatedConversationId(conversation.id);
          d.onConversationCreated?.(conversation.id);
        }

        let message = await history.submitMessage({
          text: input.text,
          context: input.context,
          modelId: input.modelId,
          parentMessageId,
          assistantConversationId: targetConversationId
        });

        let requestId = message?.request?.id;
        if (requestId) {
          setOwnedRequestIds(new Set(rememberOwnedRequest(requestId)));
          setLastRequestId(requestId);
          setLiveRequestId(requestId);
        }

        return message;
      } catch (error) {
        setSendError(getErrorMessage(error));
        throw error;
      } finally {
        setIsSending(false);
      }
    },
    [
      conversationId,
      createConversation,
      d.documentId,
      d.instanceId,
      d.onConversationCreated,
      d.skillId,
      defaultParentMessageId,
      history.submitMessage,
      scopeId
    ]
  );

  let cancel = useCallback(async () => {
    let requestId = history.activeRequestId ?? lastRequestId;
    if (!scopeId || !d.instanceId || !conversationId || !requestId) return;

    let message = history.flatMessages.find(message => message.request?.id == requestId);
    if (!message) return;

    await cancelMessage.mutate({
      organizationId: scopeId,
      instanceId: d.instanceId,
      assistantConversationId: conversationId,
      assistantMessageId: message.id
    });
    setCancelledRequestId(requestId);
    history.refetch();
  }, [
    cancelMessage,
    conversationId,
    d.instanceId,
    history.activeRequestId,
    history.flatMessages,
    history.refetch,
    lastRequestId,
    scopeId
  ]);

  let lastAssistantText = useMemo(() => {
    for (let i = liveItems.length - 1; i >= 0; i--) {
      let item = liveItems[i]!;
      if (item.type == 'message' && item.message.role == 'assistant') {
        return item.message.parts
          .map(part => (part.type == 'text' ? part.text : ''))
          .join('')
          .trim();
      }
    }
    return '';
  }, [liveItems]);

  let liveError = useMemo(() => {
    for (let item of liveItems) {
      if (item.type == 'error') return item.error.message;
    }
    return null;
  }, [liveItems]);

  return {
    conversationId,
    history,
    status,
    isBusy: status == 'sending' || status == 'running',
    error: sendError ?? liveError ?? history.streamError,
    documentEdits,
    lastAssistantText,
    send,
    cancel,
    isCancelling: cancelMessage.isLoading,
    startNewConversation: () => {
      setCreatedConversationId(null);
      setLastRequestId(null);
      setLiveRequestId(null);
    }
  };
};

export type SkillAssistant = ReturnType<typeof useSkillAssistant>;

export type SkillAssistantDocumentBinding = {
  documentId: string;
  title?: string;
  canWrite: boolean;
  getRequestContext: () => Pick<SkillAssistantRequestContext, 'selection'>;
  applyEdits: (items: SkillAssistantDocumentEditItem[]) => void;
};

export type SkillAssistantWorkspace = {
  organizationId?: string | null;
  instanceId: string;
  skillId: string;
  canWrite: boolean;
  document: SkillAssistantDocumentBinding | null;
  registerDocument: (binding: SkillAssistantDocumentBinding) => () => void;
  reportDockHeight: (height: number) => void;
  isInitialGeneration: boolean;
  finishInitialGeneration: () => void;
};

let SkillAssistantWorkspaceContext = createContext<SkillAssistantWorkspace | null>(null);

export let SkillAssistantWorkspaceProvider = (p: {
  organizationId?: string | null;
  instanceId: string | null | undefined;
  skillId: string | null | undefined;
  canWrite: boolean;
  onDockHeightChange?: (height: number) => void;
  children: ReactNode;
}) => {
  let assistantEnabled = useMetorialAssistantEnabled();
  let [document, setDocument] = useState<SkillAssistantDocumentBinding | null>(null);
  let [initialGenerationSkillId, setInitialGenerationSkillId] = useState<string | null>(() =>
    p.skillId && hasQueuedSkillAssistantPrompt(p.skillId) ? p.skillId : null
  );

  useEffect(() => {
    if (p.skillId && hasQueuedSkillAssistantPrompt(p.skillId)) {
      setInitialGenerationSkillId(p.skillId);
    }
  }, [p.skillId]);

  let finishInitialGeneration = useCallback(() => setInitialGenerationSkillId(null), []);

  useEffect(() => {
    if (!initialGenerationSkillId) return;

    let timeout = setTimeout(finishInitialGeneration, maxInitialGenerationMs);
    return () => clearTimeout(timeout);
  }, [initialGenerationSkillId, finishInitialGeneration]);

  let registerDocument = useCallback((binding: SkillAssistantDocumentBinding) => {
    setDocument(binding);
    return () => setDocument(current => (current == binding ? null : current));
  }, []);

  let onDockHeightChangeRef = useRef(p.onDockHeightChange);
  onDockHeightChangeRef.current = p.onDockHeightChange;
  let reportDockHeight = useCallback(
    (height: number) => onDockHeightChangeRef.current?.(height),
    []
  );

  let value = useMemo<SkillAssistantWorkspace | null>(
    () =>
      assistantEnabled && p.instanceId && p.skillId
        ? {
            organizationId: p.organizationId,
            instanceId: p.instanceId,
            skillId: p.skillId,
            canWrite: p.canWrite,
            document,
            registerDocument,
            reportDockHeight,
            isInitialGeneration: initialGenerationSkillId == p.skillId,
            finishInitialGeneration
          }
        : null,
    [
      assistantEnabled,
      document,
      finishInitialGeneration,
      initialGenerationSkillId,
      p.canWrite,
      p.instanceId,
      p.organizationId,
      p.skillId,
      registerDocument,
      reportDockHeight
    ]
  );

  return createElement(SkillAssistantWorkspaceContext.Provider, { value }, p.children);
};

export let useSkillAssistantWorkspace = () => useContext(SkillAssistantWorkspaceContext);
