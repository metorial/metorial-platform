import { renderWithLoader } from '@metorial/data-hooks';
import { ContentLayout, PageHeader } from '@metorial/layout';
import {
  useConversationHistory,
  useCreateConversationMessage,
  useCurrentInstance,
  useCurrentOrganization
} from '@metorial/state';
import { Error, theme } from '@metorial/ui';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import styled from 'styled-components';
import type { AssistantModelOption, AssistantSuggestion } from './components';
import { AssistantComposer, AssistantTranscript } from './components';

let ConversationLayout = styled(ContentLayout)`
  display: flex;
  flex-direction: column;
  gap: 18px;
  min-height: calc(100vh - 220px);
`;

let TranscriptPanel = styled.div`
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding-right: 4px;
  padding-bottom: 20px;
`;

let ComposerDock = styled.div`
  position: sticky;
  bottom: 0;
  display: flex;
  justify-content: center;
  background: ${theme.colors.background};
  padding-top: 18px;
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
  let [optimisticRequestId, setOptimisticRequestId] = useState<string | null>(null);
  let history = useConversationHistory(
    organization.data?.id,
    instance.data?.id,
    assistantConversationId,
    {
      pollingIntervalMs: 3000,
      streamRequestId: optimisticRequestId
    }
  );
  let createMessage = useCreateConversationMessage();

  let [draft, setDraft] = useState('');
  let [selectedModelId, setSelectedModelId] = useState<string>();
  let didConsumeInitialPromptRef = useRef(false);
  let locationState = location.state as AssistantConversationLocationState;
  let initialPrompt =
    typeof locationState?.initialPrompt == 'string' ? locationState.initialPrompt.trim() : '';
  let initialModelId =
    typeof locationState?.initialModelId == 'string' ? locationState.initialModelId : undefined;

  let modelOptions = useMemo(
    () => getModelOptions(history.conversation.data?.assistant.availableModels),
    [history.conversation.data?.assistant.availableModels]
  );

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

  let optimisticRequestStatus = useMemo(() => {
    if (!optimisticRequestId) return null;

    for (let message of history.flatMessages) {
      if (message.request?.id == optimisticRequestId) {
        return message.request.status;
      }
    }

    return null;
  }, [history.flatMessages, optimisticRequestId]);

  useEffect(() => {
    if (!optimisticRequestId) return;
    if (history.pendingRequest?.id == optimisticRequestId) {
      setOptimisticRequestId(null);
      return;
    }
    if (optimisticRequestStatus && optimisticRequestStatus != 'pending') {
      setOptimisticRequestId(null);
    }
  }, [history.pendingRequest?.id, optimisticRequestId, optimisticRequestStatus]);

  useEffect(() => {
    if (!initialPrompt || didConsumeInitialPromptRef.current) return;
    if (!organization.data || !instance.data || !assistantConversationId) return;

    let parentMessageId = history.latestMessage?.id ?? history.conversation.data?.rootMessageId;
    if (!parentMessageId) return;

    didConsumeInitialPromptRef.current = true;
    navigate(location.pathname, { replace: true, state: null });

    void createMessage
      .mutate({
        organizationId: organization.data.id,
        instanceId: instance.data.id,
        assistantConversationId,
        parentMessageId,
        modelId: initialModelId ?? selectedModelId,
        message: {
          parts: [{ type: 'text', text: initialPrompt }]
        }
      })
      .then(([createdMessage]) => {
        if (createdMessage?.request?.id) {
          setOptimisticRequestId(createdMessage.request.id);
        }
        setDraft('');
      });
  }, [
    assistantConversationId,
    createMessage,
    history.conversation.data?.rootMessageId,
    history.latestMessage?.id,
    initialModelId,
    initialPrompt,
    instance.data,
    location.pathname,
    navigate,
    organization.data,
    selectedModelId
  ]);

  let hasActiveRequest = !!history.pendingRequest || !!optimisticRequestId;
  let isSubmitting = createMessage.isLoading || hasActiveRequest;

  let handleSubmit = async () => {
    if (!draft.trim() || !organization.data || !instance.data || !assistantConversationId)
      return;

    let input = {
      organizationId: organization.data.id,
      instanceId: instance.data.id,
      assistantConversationId,
      parentMessageId: history.latestMessage?.id ?? history.conversation.data?.rootMessageId,
      modelId: selectedModelId,
      message: {
        parts: [{ type: 'text' as const, text: draft.trim() }]
      }
    };
    let [createdMessage] = await createMessage.mutate(input);

    if (createdMessage?.request?.id) {
      setOptimisticRequestId(createdMessage.request.id);
    }

    setDraft('');
  };

  return renderWithLoader({
    organization,
    instance,
    conversation: history.conversation
  })(() => (
    <ConversationLayout>
      <PageHeader
        title={history.conversation.data?.title ?? history.conversation.data?.assistant.name}
        description="Ask follow-up questions, inspect tool activity, and review the assistant's file and shell work."
      />

      {history.streamError && <Error>{history.streamError}</Error>}

      <TranscriptPanel>
        <AssistantTranscript
          messages={history.flatMessages}
          liveState={history.liveState}
          isWaitingForResponse={history.isWaitingForResponse}
        />
      </TranscriptPanel>

      <ComposerDock>
        <AssistantComposer
          value={draft}
          onChange={setDraft}
          onSubmit={handleSubmit}
          isSubmitting={isSubmitting}
          disabled={hasActiveRequest}
          selectedModelId={selectedModelId}
          modelOptions={modelOptions}
          onSelectModel={setSelectedModelId}
          suggestions={defaultSuggestions}
          onSelectSuggestion={suggestion => setDraft(suggestion.prompt)}
        />
      </ComposerDock>
    </ConversationLayout>
  ));
};
