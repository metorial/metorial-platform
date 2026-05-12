import React from 'react';
import type { AssistantConversationMessage, AssistantLiveState } from '@metorial/state';
import { Text, theme } from '@metorial/ui';
import styled from 'styled-components';
import { getTranscriptEntries } from './helpers';
import { TextShimmer } from './textShimmer';
import { AssistantStateItemCard } from './toolCards';
import type { AssistantTranscriptMessageMeta } from './types';

let TranscriptWrapper = styled.div`
  display: flex;
  flex-direction: column;
  gap: 18px;
  width: 100%;
  margin: 0 auto;
  padding: 4px 0 28px;
`;

let EmptyState = styled.div`
  padding: 72px 0;
  text-align: center;
  color: color-mix(in srgb, ${theme.colors.foreground} 58%, transparent);
`;

let ShimmerRow = styled.div`
  padding: 2px 0 4px;
`;

export let AssistantTranscript = (p: {
  messages: AssistantConversationMessage[];
  liveState?: AssistantLiveState | null;
  isWaitingForResponse?: boolean;
  messageMetaById?: Map<string, AssistantTranscriptMessageMeta>;
  editingMessageId?: string | null;
  editingValue?: string;
  isSubmittingEdit?: boolean;
  onStartEdit?: (message: AssistantConversationMessage) => void;
  onEditingChange?: (value: string) => void;
  onCancelEdit?: () => void;
  onSubmitEdit?: () => void;
  onSelectReferenceMessage?: (messageId: string) => void;
}) => {
  let entries = getTranscriptEntries(p.messages, p.liveState);

  if (!entries.length && !p.isWaitingForResponse) {
    return (
      <EmptyState>
        <Text>No messages yet.</Text>
      </EmptyState>
    );
  }

  return (
    <TranscriptWrapper>
      {entries.map(entry => (
        <AssistantStateItemCard
          key={entry.id}
          item={entry.item}
          message={entry.message}
          messageMeta={entry.message ? p.messageMetaById?.get(entry.message.id) : undefined}
          isEditing={entry.message?.id == p.editingMessageId}
          editingValue={p.editingValue}
          isSubmittingEdit={p.isSubmittingEdit}
          onStartEdit={p.onStartEdit}
          onEditingChange={p.onEditingChange}
          onCancelEdit={p.onCancelEdit}
          onSubmitEdit={p.onSubmitEdit}
          onSelectReferenceMessage={p.onSelectReferenceMessage}
        />
      ))}

      {p.isWaitingForResponse && (
        <ShimmerRow>
          <TextShimmer>Working on your request</TextShimmer>
        </ShimmerRow>
      )}
    </TranscriptWrapper>
  );
};
