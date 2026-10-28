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
import {
  allStoreItemsLoader,
  storeItemLoader,
  storeItemsLoader
} from '../files/loaders/stores';
import { skillAgentsLoader } from '../skills/loaders/skills';
import { useConversationHistory } from './conversationHistory';
import {
  useCancelConversationMessage,
  useCreateConversation,
  type AssistantLiveStateItem
} from './loaders/assistant';

export let skillsAssistantSlug = 'skills';

export type SkillAssistantMode = 'block' | 'rewrite' | 'summarize' | 'document' | 'skill';

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

export let refreshSkillStoreLoaders = () => {
  storeItemsLoader.refetchAll();
  allStoreItemsLoader.refetchAll();
  storeItemLoader.refetchAll();
  skillAgentsLoader.refetchAll();
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

  let seenChangeItemsRef = useRef(new Set<string>());
  useEffect(() => {
    let hasNewChanges = false;
    for (let item of liveItems) {
      if (item.type != 'skill/changes' || seenChangeItemsRef.current.has(item.id)) continue;
      seenChangeItemsRef.current.add(item.id);
      if (item.changes.some(change => change.status == 'committed')) hasNewChanges = true;
    }
    if (hasNewChanges) refreshSkillStoreLoaders();
  }, [liveItems]);

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

  let isTrackedRequestPending =
    !!trackedRequestId && (!trackedRequestStatus || trackedRequestStatus == 'pending');

  let status: SkillAssistantRequestStatus = isSending
    ? 'sending'
    : history.activeRequestId || history.isAssistantBusy || isTrackedRequestPending
      ? 'running'
      : trackedRequestStatus == 'failed'
        ? 'failed'
        : trackedRequestStatus == 'cancelled'
          ? 'cancelled'
          : trackedRequestId
            ? 'completed'
            : 'idle';

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
  let [document, setDocument] = useState<SkillAssistantDocumentBinding | null>(null);

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
      p.instanceId && p.skillId
        ? {
            organizationId: p.organizationId,
            instanceId: p.instanceId,
            skillId: p.skillId,
            canWrite: p.canWrite,
            document,
            registerDocument,
            reportDockHeight
          }
        : null,
    [
      document,
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
