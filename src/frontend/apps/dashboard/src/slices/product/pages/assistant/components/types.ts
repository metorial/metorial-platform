import type { AssistantConversationMessage, AssistantLiveStateItem } from '@metorial/state';

export type AssistantSuggestion = {
  id: string;
  label: string;
  prompt: string;
};

export type AssistantModelOption = {
  id: string;
  label: string;
  description?: string | null;
};

export type AssistantTranscriptEntry = {
  id: string;
  source: 'persisted' | 'live';
  item: AssistantLiveStateItem;
  message?: AssistantConversationMessage;
};
