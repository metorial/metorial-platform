import { renderWithLoader } from '@metorial/data-hooks';
import { PageHeader } from '@metorial/layout';
import {
  useConversationHistory,
  useCurrentInstance,
  useCurrentOrganization
} from '@metorial/state';
import { Button, Error, Text, theme } from '@metorial/ui';
import { RiCloseLine } from '@remixicon/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import styled from 'styled-components';
import {
  AssistantComposer,
  AssistantTranscript,
  getMessageText,
  type AssistantModelOption,
  type AssistantSuggestion,
  type AssistantTranscriptMessageMeta
} from './components';

let ConversationScrollContainer = styled.div`
  height: 100%;
  min-height: 0;
  overflow: auto;
`;

let ConversationLayout = styled.div`
  display: flex;
  flex-direction: column;
  gap: 18px;
  min-height: 100%;
  max-width: 1000px;
  margin: 0 auto;
  padding: 50px 20px 0px 20px;
  box-sizing: border-box;
`;

let TranscriptPanel = styled.div`
  flex: 1;
  min-height: 0;
  padding-right: 4px;
  padding-bottom: 20px;
`;

let ComposerDock = styled.div`
  position: relative;
  position: sticky;
  bottom: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  background: ${theme.colors.background};
  padding-bottom: 20px;
`;

let FollowupCard = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
  padding: 12px 14px;
  border-radius: 14px;
  border: 1px solid color-mix(in srgb, ${theme.colors.foreground} 10%, transparent);
  background: ${theme.colors.background};
  box-shadow:
    0 1px 2px rgba(15, 23, 42, 0.06),
    0 8px 24px rgba(15, 23, 42, 0.08);
`;

let FollowupPreview = styled(Text)`
  flex: 1;
  min-width: 0;
  color: ${theme.colors.foreground};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

let ComposerDockSpacer = styled.div`
  position: absolute;
  top: -24px;
  right: 0;
  left: 0;
  height: 24px;
  pointer-events: none;
  background: linear-gradient(
    to bottom,
    rgb(255 255 255 / 0%) 0%,
    rgb(255 255 255 / 100%) 100%
  );
`;

let defaultSuggestions: AssistantSuggestion[] = [
  {
    id: 'summarize',
    label: 'Summarize the instance',
    prompt: 'Summarize the current state of this instance and the most important next steps.'
  },
  {
    id: 'investigate',
    label: 'Investigate an error',
    prompt: 'Investigate the likely root cause of the issue I am looking at.'
  },
  {
    id: 'review',
    label: 'Review recent changes',
    prompt: 'Review the relevant files and explain the most important changes.'
  }
];

let getModelOptions = (
  models:
    | {
        id: string;
        name: string;
        provider: { name: string };
      }[]
    | undefined
) => {
  return (
    models?.map(
      model =>
        ({
          id: model.id,
          label: model.name,
          description: model.provider.name
        }) satisfies AssistantModelOption
    ) ?? []
  );
};

let getComposerParentMessageId = (d: {
  referenceMessage:
    | ReturnType<typeof useConversationHistory>['referenceMessage']
    | null
    | undefined;
  rootMessageId: string | null | undefined;
}) => {
  if (!d.referenceMessage) return d.rootMessageId ?? null;
  if (d.referenceMessage.type == 'assistant' || d.referenceMessage.type == 'root') {
    return d.referenceMessage.id;
  }

  return null;
};

type AssistantConversationLocationState = {
  initialPrompt?: string;
  initialModelId?: string;
} | null;

export let AssistantConversationPage = () => {
  let navigate = useNavigate();
  let location = useLocation();
  let { assistantConversationId } = useParams();
  let organization = useCurrentOrganization();
  let instance = useCurrentInstance();
  let history = useConversationHistory(
    organization.data?.id,
    instance.data?.id,
    assistantConversationId,
    {
      pollingIntervalMs: 3000
    }
  );

  let [draft, setDraft] = useState('');
  let [selectedModelId, setSelectedModelId] = useState<string>();
  let [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  let [editingDraft, setEditingDraft] = useState('');
  let [queuedFollowup, setQueuedFollowup] = useState<{
    text: string;
    modelId?: string;
    pendingParentMessageId?: string | null;
  } | null>(null);
  let [isSubmittingComposer, setIsSubmittingComposer] = useState(false);
  let didConsumeInitialPromptRef = useRef(false);
  let scrollContainerRef = useRef<HTMLDivElement | null>(null);
  let shouldAutoScrollRef = useRef(true);
  let autoScrollIgnoreUntilRef = useRef(0);
  let autoScrollTargetTopRef = useRef(0);
  let autoScrollResetTimeoutRef = useRef<number | null>(null);
  let locationState = location.state as AssistantConversationLocationState;
  let initialPrompt =
    typeof locationState?.initialPrompt == 'string' ? locationState.initialPrompt.trim() : '';
  let initialModelId =
    typeof locationState?.initialModelId == 'string'
      ? locationState.initialModelId
      : undefined;

  let modelOptions = useMemo(
    () => getModelOptions(history.conversation.data?.assistant.availableModels),
    [history.conversation.data?.assistant.availableModels]
  );
  let composerParentMessageId = getComposerParentMessageId({
    referenceMessage: history.referenceMessage,
    rootMessageId: history.conversation.data?.rootMessageId
  });

  useEffect(() => {
    (window as any).metorial_setRestrictHeight?.(true);

    return () => {
      (window as any).metorial_setRestrictHeight?.(false);
    };
  }, []);

  useEffect(() => {
    let defaultModelId = history.conversation.data?.assistant.defaultModel?.id;
    if (!defaultModelId) return;
    setSelectedModelId(current => current ?? defaultModelId);
  }, [history.conversation.data?.assistant.defaultModel?.id]);

  useEffect(() => {
    if (!initialModelId) return;
    setSelectedModelId(current => current ?? initialModelId);
  }, [initialModelId]);

  useEffect(() => {
    if (!initialPrompt || didConsumeInitialPromptRef.current) return;
    setDraft(current => current || initialPrompt);
  }, [initialPrompt]);

  useEffect(() => {
    if (!initialPrompt || didConsumeInitialPromptRef.current) return;
    if (!organization.data || !instance.data || !assistantConversationId) return;

    let parentMessageId = composerParentMessageId;
    if (!parentMessageId) return;

    didConsumeInitialPromptRef.current = true;
    navigate(location.pathname, { replace: true, state: null });

    void history
      .submitMessage({
        text: initialPrompt,
        parentMessageId,
        modelId: initialModelId ?? selectedModelId
      })
      .then(() => {
        shouldAutoScrollRef.current = true;
        setDraft('');
      });
  }, [
    assistantConversationId,
    history.conversation.data?.rootMessageId,
    history.referenceMessage?.id,
    history.submitMessage,
    initialModelId,
    initialPrompt,
    instance.data,
    location.pathname,
    navigate,
    organization.data,
    selectedModelId
  ]);

  useEffect(() => {
    if (
      !queuedFollowup ||
      !history.isAssistantReady ||
      history.isCreatingMessage ||
      !composerParentMessageId ||
      composerParentMessageId == queuedFollowup.pendingParentMessageId
    ) {
      return;
    }

    let didCancel = false;
    let followup = queuedFollowup;

    setIsSubmittingComposer(true);
    setQueuedFollowup(null);
    shouldAutoScrollRef.current = true;

    void history
      .submitMessage({
        text: followup.text,
        parentMessageId: composerParentMessageId,
        modelId: followup.modelId
      })
      .catch(() => {
        if (!didCancel) setQueuedFollowup(followup);
      })
      .finally(() => {
        if (!didCancel) setIsSubmittingComposer(false);
      });

    return () => {
      didCancel = true;
    };
  }, [
    composerParentMessageId,
    history.isAssistantReady,
    history.isCreatingMessage,
    history.submitMessage,
    queuedFollowup
  ]);

  useEffect(() => {
    if (!editingMessageId) return;
    if (history.currentNodesById.has(editingMessageId)) return;

    setEditingMessageId(null);
    setEditingDraft('');
  }, [editingMessageId, history.currentNodesById]);

  let messageMetaById = useMemo(() => {
    return new Map<string, AssistantTranscriptMessageMeta>(
      history.currentPath.map(node => [
        node.id,
        {
          node,
          parent: node.parent,
          previousSibling: node.previousSibling,
          nextSibling: node.nextSibling,
          siblingIndex: node.siblingIndex,
          siblingCount: node.siblings.length
        }
      ])
    );
  }, [history.currentPath]);

  let getIsNearBottom = () => {
    let container = scrollContainerRef.current;
    if (!container) return true;

    let remaining = container.scrollHeight - container.scrollTop - container.clientHeight;
    return remaining <= 48;
  };

  let scrollTranscriptToBottom = (behavior: ScrollBehavior = 'auto') => {
    let container = scrollContainerRef.current;
    if (!container) return;

    autoScrollTargetTopRef.current = Math.max(
      0,
      container.scrollHeight - container.clientHeight
    );
    autoScrollIgnoreUntilRef.current = Date.now() + 200;
    if (autoScrollResetTimeoutRef.current) {
      window.clearTimeout(autoScrollResetTimeoutRef.current);
    }
    autoScrollResetTimeoutRef.current = window.setTimeout(() => {
      autoScrollIgnoreUntilRef.current = 0;
      autoScrollResetTimeoutRef.current = null;
    }, 200);

    container.scrollTo({
      top: container.scrollHeight,
      behavior
    });
  };

  useEffect(() => {
    if (!shouldAutoScrollRef.current) return;

    let frame = window.requestAnimationFrame(() => {
      scrollTranscriptToBottom();
    });

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [history.currentMessages.length, history.liveSnapshotIndex, history.liveItems.length]);

  useEffect(() => {
    return () => {
      if (autoScrollResetTimeoutRef.current) {
        window.clearTimeout(autoScrollResetTimeoutRef.current);
      }
    };
  }, []);

  let isSubmitting = isSubmittingComposer || history.isCreatingMessage;
  let handleSubmit = async () => {
    if (!draft.trim()) return;

    let nextText = draft.trim();
    setDraft('');
    shouldAutoScrollRef.current = true;

    if (!history.isAssistantReady || !composerParentMessageId) {
      setQueuedFollowup({
        text: nextText,
        modelId: selectedModelId,
        pendingParentMessageId:
          history.referenceMessage?.id ?? history.conversation.data?.rootMessageId ?? null
      });
      return;
    }

    setIsSubmittingComposer(true);

    try {
      await history.submitMessage({
        text: nextText,
        parentMessageId: composerParentMessageId,
        modelId: selectedModelId
      });
    } finally {
      setIsSubmittingComposer(false);
    }
  };

  let handleStartEdit = (message: (typeof history.currentMessages)[number]) => {
    setEditingMessageId(message.id);
    setEditingDraft(getMessageText(message));
    history.setReferenceMessage(message.id);
  };

  let handleCancelEdit = () => {
    setEditingMessageId(null);
    setEditingDraft('');
  };

  let handleSubmitEdit = async () => {
    if (!editingMessageId || !editingDraft.trim()) return;

    let editingMessage =
      history.nodesById.get(editingMessageId)?.message ??
      history.flatMessages.find(message => message.id == editingMessageId);
    let parentMessageId =
      editingMessage?.parentMessageId ?? history.conversation.data?.rootMessageId;
    if (!parentMessageId) return;

    await history.submitMessage({
      text: editingDraft,
      parentMessageId,
      modelId: selectedModelId
    });

    shouldAutoScrollRef.current = true;
    setEditingMessageId(null);
    setEditingDraft('');
  };

  return renderWithLoader({
    organization,
    instance,
    conversation: history.conversation
  })(() => (
    <ConversationScrollContainer
      ref={scrollContainerRef}
      onScroll={() => {
        let container = scrollContainerRef.current;
        if (!container) return;

        let isNearBottom = getIsNearBottom();
        if (isNearBottom) {
          shouldAutoScrollRef.current = true;
          return;
        }

        let isProgrammaticScrollEvent =
          Date.now() <= autoScrollIgnoreUntilRef.current &&
          Math.abs(container.scrollTop - autoScrollTargetTopRef.current) <= 48;
        if (isProgrammaticScrollEvent) return;

        shouldAutoScrollRef.current = false;
      }}
    >
      <ConversationLayout>
        <PageHeader
          title={history.conversation.data?.title ?? history.conversation.data?.assistant.name}
          description="Ask follow-up questions, inspect tool activity, and review the assistant's file and shell work."
        />

        {history.streamError && <Error>{history.streamError}</Error>}

        <TranscriptPanel>
          <AssistantTranscript
            messages={history.currentMessages}
            liveState={history.liveState}
            isWaitingForResponse={history.isWaitingForResponse}
            messageMetaById={messageMetaById}
            editingMessageId={editingMessageId}
            editingValue={editingDraft}
            isSubmittingEdit={history.isCreatingMessage}
            onStartEdit={handleStartEdit}
            onEditingChange={setEditingDraft}
            onCancelEdit={handleCancelEdit}
            onSubmitEdit={handleSubmitEdit}
            onSelectReferenceMessage={history.setReferenceMessage}
          />
        </TranscriptPanel>

        <ComposerDock>
          <ComposerDockSpacer />

          {queuedFollowup && (
            <FollowupCard>
              <FollowupPreview size="1">
                Follow-up: {queuedFollowup.text.slice(0, 100)}
                {queuedFollowup.text.length > 100 ? '...' : ''}
              </FollowupPreview>

              <Button
                type="button"
                size="1"
                variant="ghost"
                iconLeft={<RiCloseLine />}
                onClick={() => setQueuedFollowup(null)}
              />
            </FollowupCard>
          )}

          <AssistantComposer
            value={draft}
            onChange={setDraft}
            onSubmit={handleSubmit}
            isSubmitting={isSubmitting}
            disabled={false}
            selectedModelId={selectedModelId}
            modelOptions={modelOptions}
            onSelectModel={setSelectedModelId}
            suggestions={defaultSuggestions}
            onSelectSuggestion={suggestion => setDraft(suggestion.prompt)}
          />
        </ComposerDock>
      </ConversationLayout>
    </ConversationScrollContainer>
  ));
};
