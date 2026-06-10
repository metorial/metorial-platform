import { AssistantConversationScene, AssistantStartScene } from '@metorial/scene-assistant';
import { Button, Text, theme } from '@metorial/ui';
import { RiFileList3Line } from '@remixicon/react';
import type { ReactNode } from 'react';
import { useState } from 'react';
import styled from 'styled-components';
import { BreathingIndicator } from './breathing';

let Header = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

let HeaderTitle = styled(Text).attrs({
  size: '3',
  weight: 'strong',
  color: 'gray900'
})``;

let HeaderDescription = styled(Text).attrs({
  size: '2',
  color: 'gray600'
})`
  max-width: 720px;
`;

let Wrapper = styled.div`
  height: 100%;
  min-height: 0;
  background: ${theme.colors.background};
  display: flex;
  flex-direction: column;
`;

let ConnectionNav = styled.nav`
  display: flex;
  gap: 10px;
  justify-content: space-between;
  border-bottom: solid ${theme.colors.gray300} 1px;
`;

let ConnectionNavSection = styled.nav`
  padding: 7px 12px;
  display: flex;
  gap: 10px;
  align-items: center;
`;

let Status = styled.div`
  display: flex;
  gap: 6px;
  align-items: center;
  color: ${theme.colors.green900};
  font-size: 14px;
  font-weight: 500;
`;

let Body = styled.div`
  flex: 1;
  min-height: 0;
  overflow: auto;
`;

let suggestions = [
  {
    id: 'list-tools',
    label: 'List available tools',
    prompt: 'What tools are available in this integration session?'
  },
  {
    id: 'inspect-capabilities',
    label: 'Explain capabilities',
    prompt: 'Explain what I can do with the connected integrations in this session.'
  },
  {
    id: 'run-next-step',
    label: 'Recommend next step',
    prompt: 'What is the best next action to take with this integration session?'
  }
];

export let ExplorerAssistantFrame = (p: {
  sessionId: string;
  assistantConversationId?: string | null;
  modeSelector?: ReactNode;
  onOpenLogs?: () => void;
  onAssistantConversationIdChange: (conversationId: string) => void;
  setRestrictHeight?: (enabled: boolean) => void;
}) => {
  let [initialMessage, setInitialMessage] = useState<{
    prompt?: string;
    modelId?: string;
  } | null>(null);

  return (
    <Wrapper>
      <ConnectionNav>
        <ConnectionNavSection>
          <Status>
            <BreathingIndicator />
            <span>
              Connected via <i>Metorial Magic Network</i>
            </span>
          </Status>
        </ConnectionNavSection>

        <ConnectionNavSection>
          {p.onOpenLogs && (
            <Button
              size="2"
              variant="outline"
              iconLeft={<RiFileList3Line />}
              onClick={p.onOpenLogs}
            >
              Open Logs
            </Button>
          )}

          {p.modeSelector}
        </ConnectionNavSection>
      </ConnectionNav>

      <Body>
        {p.assistantConversationId ? (
          <AssistantConversationScene
            assistantConversationId={p.assistantConversationId}
            initialPrompt={initialMessage?.prompt}
            initialModelId={initialMessage?.modelId}
            onInitialPromptConsumed={() => setInitialMessage(null)}
            layout="embedded"
            suggestions={suggestions}
            setRestrictHeight={p.setRestrictHeight}
            renderHeader={({ title, description }) => (
              <Header>
                <HeaderTitle>{title ?? 'Explorer Assistant'}</HeaderTitle>
                <HeaderDescription>{description}</HeaderDescription>
              </Header>
            )}
          />
        ) : (
          <AssistantStartScene
            assistantSlug="explorer"
            conversationInput={{ sessionId: p.sessionId }}
            title="Explore this integration with an assistant"
            description="Ask Metorial to inspect available tools, explain capabilities, and invoke this session's integrations for you."
            suggestions={suggestions}
            layout="embedded"
            onOpenConversation={(conversationId, state) => {
              setInitialMessage({
                prompt: state?.initialPrompt,
                modelId: state?.initialModelId
              });
              p.onAssistantConversationIdChange(conversationId);
            }}
          />
        )}
      </Body>
    </Wrapper>
  );
};
