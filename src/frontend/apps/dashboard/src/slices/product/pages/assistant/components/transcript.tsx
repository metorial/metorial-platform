import type { AssistantConversationMessage, AssistantLiveState } from '@metorial/state';
import { Text, theme } from '@metorial/ui';
import styled from 'styled-components';
import { getTranscriptEntries } from './helpers';
import { TextShimmer } from './textShimmer';
import { AssistantStateItemCard } from './toolCards';

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
        <AssistantStateItemCard key={entry.id} item={entry.item} message={entry.message} />
      ))}

      {p.isWaitingForResponse && (
        <ShimmerRow>
          <TextShimmer>Working our your request</TextShimmer>
        </ShimmerRow>
      )}
    </TranscriptWrapper>
  );
};
