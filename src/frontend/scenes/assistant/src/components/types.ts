import type {
  AssistantConversationHistoryNode,
  AssistantConversationMessage,
  AssistantLiveStateItem
} from '@metorial/state';

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

export type AssistantTranscriptMessageMeta = {
  node: AssistantConversationHistoryNode;
  parent: AssistantConversationHistoryNode | null;
  previousSibling: AssistantConversationHistoryNode | null;
  nextSibling: AssistantConversationHistoryNode | null;
  siblingIndex: number;
  siblingCount: number;
};

export type AssistantConversationNavigationState = {
  initialPrompt?: string;
  initialModelId?: string;
} | null;
