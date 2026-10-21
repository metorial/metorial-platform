import {
  useSkillAssistant,
  useSkillAssistantWorkspace,
  type SkillAssistantRequestContext
} from '@metorial/state';
import { Menu, Text, theme, Tooltip } from '@metorial/ui';
import {
  RiAddLine,
  RiArrowDownSLine,
  RiArrowUpLine,
  RiChatHistoryLine,
  RiEditLine,
  RiEyeLine,
  RiSparkling2Line,
  RiStopFill
} from '@remixicon/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import TextareaAutosize from 'react-textarea-autosize';
import styled from 'styled-components';
import { AssistantTranscript } from './transcript';

type StoredConversation = { id: string; title: string; createdAt: number };

let maxStoredConversations = 20;
let conversationsStorageKey = (skillId: string) =>
  `metorial:skill-assistant:conversations:${skillId}`;

let readStoredConversations = (skillId: string): StoredConversation[] => {
  try {
    let parsed = JSON.parse(
      window.localStorage.getItem(conversationsStorageKey(skillId)) ?? '[]'
    );
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

let writeStoredConversations = (skillId: string, conversations: StoredConversation[]) => {
  try {
    window.localStorage.setItem(
      conversationsStorageKey(skillId),
      JSON.stringify(conversations.slice(0, maxStoredConversations))
    );
  } catch {}
};

let DockRoot = styled.div`
  position: absolute;
  left: 50%;
  bottom: 20px;
  z-index: 30;
  display: flex;
  flex-direction: column;
  width: min(680px, calc(100% - 48px));
  transform: translateX(-50%);
  pointer-events: none;

  & > * {
    pointer-events: auto;
  }
`;

let Panel = styled.div`
  display: flex;
  flex-direction: column;
  min-height: 0;
  max-height: min(60vh, 560px);
  margin-bottom: 10px;
  border: 1px solid ${theme.colors.gray400};
  border-radius: 14px;
  background: ${theme.colors.background};
  box-shadow: ${theme.shadows.large};
  overflow: hidden;
`;

let PanelHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 8px 10px 8px 14px;
  border-bottom: 1px solid ${theme.colors.gray300};
`;

let PanelTitle = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
`;

let PanelActions = styled.div`
  display: flex;
  align-items: center;
  gap: 2px;
`;

let PanelScroll = styled.div`
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 12px 14px 0;
`;

let ComposerCard = styled.div`
  display: flex;
  align-items: flex-end;
  gap: 8px;
  padding: 8px 8px 8px 12px;
  border: 1px solid ${theme.colors.gray400};
  border-radius: 14px;
  background: ${theme.colors.background};
  box-shadow: ${theme.shadows.large};
`;

let ComposerInput = styled(TextareaAutosize)`
  flex: 1;
  min-width: 0;
  max-height: 160px;
  padding: 6px 0;
  border: none;
  outline: none;
  resize: none;
  background: transparent;
  color: ${theme.colors.foreground};
  font: inherit;
  font-size: 14px;
  line-height: 1.5;

  &::placeholder {
    color: ${theme.colors.gray600};
  }
`;

let ModeChip = styled.span<{ 'data-mode': 'edit' | 'read' }>`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  flex: 0 0 auto;
  height: 22px;
  padding: 0 8px;
  margin-bottom: 6px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 600;
  background: ${p =>
    p['data-mode'] == 'edit'
      ? `color-mix(in srgb, ${theme.colors.blue800} 10%, transparent)`
      : theme.colors.gray200};
  color: ${p => (p['data-mode'] == 'edit' ? theme.colors.blue800 : theme.colors.gray700)};
`;

let IconButton = styled.button<{ 'data-variant'?: 'primary' }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  width: 30px;
  height: 30px;
  padding: 0;
  border: none;
  border-radius: 999px;
  background: ${p =>
    p['data-variant'] == 'primary' ? theme.colors.foreground : 'transparent'};
  color: ${p =>
    p['data-variant'] == 'primary' ? theme.colors.background : theme.colors.gray700};
  cursor: pointer;

  &:hover:not(:disabled) {
    background: ${p =>
      p['data-variant'] == 'primary' ? theme.colors.foreground : theme.colors.gray200};
  }

  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
`;

export let SkillAssistantDock = () => {
  let workspace = useSkillAssistantWorkspace();
  let skillId = workspace?.skillId;
  let document = workspace?.document ?? null;

  let [storedConversations, setStoredConversations] = useState<StoredConversation[]>([]);
  let [conversationId, setConversationId] = useState<string | null>(null);
  let [draft, setDraft] = useState('');
  let [expanded, setExpanded] = useState(false);
  let pendingTitleRef = useRef('');
  let scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!skillId) return;
    let stored = readStoredConversations(skillId);
    setStoredConversations(stored);
    setConversationId(stored[0]?.id ?? null);
  }, [skillId]);

  let onConversationCreated = useCallback(
    (id: string) => {
      if (!skillId) return;
      setConversationId(id);
      setStoredConversations(current => {
        let next = [
          {
            id,
            title: pendingTitleRef.current.slice(0, 80) || 'New chat',
            createdAt: Date.now()
          },
          ...current.filter(conversation => conversation.id != id)
        ];
        writeStoredConversations(skillId, next);
        return next;
      });
    },
    [skillId]
  );

  let assistant = useSkillAssistant({
    organizationId: workspace?.organizationId,
    instanceId: workspace?.instanceId,
    skillId,
    documentId: document?.documentId,
    conversationId,
    onConversationCreated
  });

  let canEdit = !!workspace?.canWrite && (document ? document.canWrite : true);

  useEffect(() => {
    if (document && assistant.documentEdits.length)
      document.applyEdits(assistant.documentEdits);
  }, [assistant.documentEdits, document]);

  let messageCount = assistant.history.currentMessages.filter(
    message => message.type != 'root'
  ).length;

  useEffect(() => {
    let element = scrollRef.current;
    if (element) element.scrollTop = element.scrollHeight;
  }, [assistant.history.liveState, messageCount, expanded]);

  let submit = async () => {
    let text = draft.trim();
    if (!text || assistant.isBusy || !workspace) return;

    let context: SkillAssistantRequestContext = document
      ? {
          mode: 'document',
          documentId: document.documentId,
          placement: 'chat',
          ...document.getRequestContext()
        }
      : { mode: 'skill', placement: 'chat' };

    pendingTitleRef.current = text;
    setDraft('');
    setExpanded(true);

    try {
      await assistant.send({ text, context });
    } catch {
      setDraft(current => current || text);
    }
  };

  let startNewChat = () => {
    assistant.startNewConversation();
    setConversationId(null);
    setExpanded(false);
  };

  let historyItems = useMemo(
    () =>
      storedConversations.map(conversation => ({
        id: conversation.id,
        label: conversation.title
      })),
    [storedConversations]
  );

  if (!workspace) return null;

  let placeholder = document
    ? canEdit
      ? 'Ask the assistant to edit or explain this document…'
      : 'Ask a question about this document…'
    : canEdit
      ? 'Ask the assistant to work on this skill…'
      : 'Ask a question about this skill…';

  return (
    <DockRoot>
      {expanded && conversationId && (
        <Panel>
          <PanelHeader>
            <PanelTitle>
              <RiSparkling2Line size={15} />
              <Text size="2" weight="medium">
                {assistant.history.conversation.data?.title?.trim() || 'Skill assistant'}
              </Text>
            </PanelTitle>
            <PanelActions>
              {historyItems.length > 1 && (
                <Menu
                  items={historyItems}
                  onItemClick={id => {
                    assistant.startNewConversation();
                    setConversationId(id);
                  }}
                >
                  <IconButton type="button" aria-label="Previous chats" title="Previous chats">
                    <RiChatHistoryLine size={16} />
                  </IconButton>
                </Menu>
              )}
              <Tooltip content="New chat">
                <IconButton type="button" aria-label="New chat" onClick={startNewChat}>
                  <RiAddLine size={16} />
                </IconButton>
              </Tooltip>
              <Tooltip content="Collapse">
                <IconButton
                  type="button"
                  aria-label="Collapse"
                  onClick={() => setExpanded(false)}
                >
                  <RiArrowDownSLine size={16} />
                </IconButton>
              </Tooltip>
            </PanelActions>
          </PanelHeader>
          <PanelScroll ref={scrollRef}>
            <AssistantTranscript
              messages={assistant.history.currentMessages}
              liveState={assistant.history.liveState}
              isWaitingForResponse={assistant.history.isWaitingForResponse}
              error={assistant.error}
            />
          </PanelScroll>
        </Panel>
      )}

      <ComposerCard onFocus={() => conversationId && messageCount > 0 && setExpanded(true)}>
        <ModeChip
          data-mode={canEdit ? 'edit' : 'read'}
          title={
            canEdit
              ? 'The assistant can edit this skill'
              : 'You have read-only access, so the assistant can only answer questions'
          }
        >
          {canEdit ? <RiEditLine size={12} /> : <RiEyeLine size={12} />}
          {canEdit ? 'Edit' : 'Read-only'}
        </ModeChip>
        <ComposerInput
          value={draft}
          minRows={1}
          placeholder={placeholder}
          onChange={event => setDraft(event.currentTarget.value)}
          onKeyDown={event => {
            if (event.key == 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault();
              void submit();
            }
          }}
        />
        {assistant.isBusy ? (
          <IconButton
            type="button"
            data-variant="primary"
            aria-label="Stop"
            title="Stop"
            disabled={assistant.isCancelling || assistant.status == 'sending'}
            onClick={() => void assistant.cancel()}
          >
            <RiStopFill size={14} />
          </IconButton>
        ) : (
          <IconButton
            type="button"
            data-variant="primary"
            aria-label="Send"
            title="Send"
            disabled={!draft.trim()}
            onClick={() => void submit()}
          >
            <RiArrowUpLine size={16} />
          </IconButton>
        )}
      </ComposerCard>
    </DockRoot>
  );
};
