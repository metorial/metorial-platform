import type {
  AssistantConversationMessage,
  AssistantLiveState,
  AssistantLiveStateItem
} from '@metorial/state';
import type { AssistantTranscriptEntry } from './types';

let isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value == 'object' && !Array.isArray(value);

let getStateItems = (message: AssistantConversationMessage): AssistantLiveStateItem[] => {
  let items = isRecord(message.state) ? message.state.items : null;
  return Array.isArray(items) ? (items as AssistantLiveStateItem[]) : [];
};

export let getMessageItem = (
  message: AssistantConversationMessage
): Extract<AssistantLiveStateItem, { type: 'message' }> | null => {
  let items = getStateItems(message);
  let messageItem = items.find(item => item.type == 'message');

  if (messageItem?.type == 'message') {
    return messageItem;
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
    let items = getStateItems(message);

    for (let item of items) {
      entries.push({
        id: `${message.id}:${item.id}`,
        source: 'persisted',
        item,
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
