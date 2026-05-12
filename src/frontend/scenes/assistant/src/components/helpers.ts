import type {
  AssistantConversationMessage,
  AssistantLiveState,
  AssistantLiveStateItem
} from '@metorial/state';
import type { AssistantTranscriptEntry } from './types';

let getPersistedMessageItems = (message: AssistantConversationMessage): AssistantLiveStateItem[] => {
  return Array.isArray((message as any).items)
    ? ((message as any).items as AssistantLiveStateItem[])
    : [];
};

export let getMessageItem = (
  message: AssistantConversationMessage
): Extract<AssistantLiveStateItem, { type: 'message' }> | null => {
  let messageItem = getPersistedMessageItems(message).find(item => item.type == 'message');

  if (messageItem?.type == 'message') {
    return messageItem as any;
  }

  return null;
};

export let getMessageText = (message: AssistantConversationMessage) => {
  let messageItem = getMessageItem(message);
  if (!messageItem) return '';

  return messageItem.message.parts
    .map(part => {
      if (part.type == 'text') return part.text;
      return part.filename ?? `${part.mediaType} attachment`;
    })
    .join('\n\n')
    .trim();
};

export let getTranscriptEntries = (
  messages: AssistantConversationMessage[],
  liveState?: AssistantLiveState | null
): AssistantTranscriptEntry[] => {
  let entries: AssistantTranscriptEntry[] = [];

  for (let message of messages) {
    for (let item of getPersistedMessageItems(message)) {
      entries.push({
        id: `${message.id}:${item.id}`,
        source: 'persisted',
        item: item as any,
        message
      });
    }
  }

  for (let item of liveState?.items ?? []) {
    entries.push({
      id: `live:${item.id}`,
      source: 'live',
      item
    });
  }

  return entries;
};
