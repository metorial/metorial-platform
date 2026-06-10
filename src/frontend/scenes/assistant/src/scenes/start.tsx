import { renderWithLoader } from '@metorial/data-hooks';
import {
  metorialAssistantSlug,
  useAssistant,
  useCreateConversation,
  useCurrentInstance,
  useCurrentOrganization,
  useUser
} from '@metorial/state';
import { theme } from '@metorial/ui';
import { useEffect, useMemo, useState } from 'react';
import styled from 'styled-components';
import type {
  AssistantConversationNavigationState,
  AssistantModelOption,
  AssistantSuggestion
} from '../components';
import { AssistantComposer } from '../components';

let CenterLayout = styled.div<{ 'data-layout': 'page' | 'embedded' }>`
  display: flex;
  flex-direction: column;
  gap: 18px;
  width: 100%;
  min-width: 0;
  min-height: ${p => (p['data-layout'] == 'embedded' ? '100%' : 'calc(100vh - 120px)')};
  max-width: 1000px;
  margin: 0 auto;
  padding: ${p => (p['data-layout'] == 'embedded' ? '32px 20px' : '50px 20px 0px 20px')};
  justify-content: center;
  box-sizing: border-box;
`;

let Hero = styled.div`
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
  max-width: 860px;
  display: flex;
  flex-direction: column;
  gap: 24px;
  margin: 0px auto;
`;

let Title = styled.h1`
  margin: 0;
  font-size: 28px;
  line-height: 1.1;
  text-align: center;
  font-weight: 600;
`;

let Description = styled.p`
  text-align: center;
  color: ${theme.colors.gray600};
  font-size: 13px;
  margin-top: 20px;
  font-weight: 500;
`;

let defaultSuggestions: AssistantSuggestion[] = [
  {
    id: 'provider-errors',
    label: 'Summarize provider errors',
    prompt: 'Summarize the most important provider errors in this instance.'
  },
  {
    id: 'configuration-review',
    label: 'Review configuration',
    prompt: 'Review this instance configuration and suggest the most useful next steps.'
  },
  {
    id: 'find-files',
    label: 'Find relevant files',
    prompt: 'Find the most relevant files and recent changes for the issue I am investigating.'
  }
];

let getModelOptions = (assistant: ReturnType<typeof useAssistant>['data']) => {
  return (
    assistant?.availableModels.map(
      model =>
        ({
          id: model.id,
          label: model.name,
          description: model.provider.name
        }) satisfies AssistantModelOption
    ) ?? []
  );
};

export let AssistantStartScene = (p: {
  assistantSlug?: string;
  title?: string;
  description?: string;
  suggestions?: AssistantSuggestion[];
  conversationInput?: Record<string, unknown>;
  layout?: 'page' | 'embedded';
  onOpenConversation: (
    conversationId: string,
    state: AssistantConversationNavigationState
  ) => void;
}) => {
  let organization = useCurrentOrganization();
  let instance = useCurrentInstance();
  let assistant = useAssistant(
    organization.data?.id,
    instance.data?.id,
    p.assistantSlug ?? metorialAssistantSlug
  );
  let createConversation = useCreateConversation();
  let user = useUser();

  let [draft, setDraft] = useState('');
  let [selectedModelId, setSelectedModelId] = useState<string>();

  let modelOptions = useMemo(() => getModelOptions(assistant.data), [assistant.data]);

  useEffect(() => {
    if (!assistant.data) return;
    setSelectedModelId(current => current ?? assistant.data?.defaultModel?.id ?? undefined);
  }, [assistant.data]);

  let isSubmitting = createConversation.isLoading;

  let handleSubmit = async () => {
    if (!draft.trim() || !organization.data || !instance.data || !assistant.data) return;

    let [conversation] = await createConversation.mutate({
      organizationId: organization.data.id,
      instanceId: instance.data.id,
      assistantId: assistant.data.id,
      input: p.conversationInput
    });
    if (!conversation) return;

    let initialPrompt = draft.trim();
    setDraft('');

    p.onOpenConversation(conversation.id, {
      initialPrompt,
      initialModelId: selectedModelId
    });
  };

  return renderWithLoader({ organization, instance, assistant })(() => (
    <CenterLayout data-layout={p.layout ?? 'page'}>
      <Hero>
        <div>
          <Title>{p.title ?? `How can I help you, ${user.data?.firstName}?`}</Title>

          {p.description ? <Description>{p.description}</Description> : null}
        </div>

        <AssistantComposer
          value={draft}
          onChange={setDraft}
          onSubmit={handleSubmit}
          isSubmitting={isSubmitting}
          selectedModelId={selectedModelId}
          modelOptions={modelOptions}
          onSelectModel={setSelectedModelId}
          suggestions={p.suggestions ?? defaultSuggestions}
          onSelectSuggestion={suggestion => setDraft(suggestion.prompt)}
          submitLabel="Start conversation"
        />
      </Hero>
    </CenterLayout>
  ));
};
