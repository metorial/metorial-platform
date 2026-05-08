import type {
  AssistantConversationMessage,
  AssistantLiveState,
  AssistantLiveStateItem
} from '@metorial/state';
import type { MessagePart } from '@metorial/module-assistant/src/proto/types';
import type { AssistantTranscriptEntry } from './types';

let isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value == 'object' && !Array.isArray(value);

let getStateItems = (message: AssistantConversationMessage): AssistantLiveStateItem[] => {
  let items = isRecord(message.state) ? message.state.items : null;
  return Array.isArray(items) ? (items as AssistantLiveStateItem[]) : [];
};

let getSerializedMessageItem = (
  message: AssistantConversationMessage
): AssistantLiveStateItem | null => {
  if (!isRecord(message.serialized)) return null;

  let serializedMessages = message.serialized.messages;
  if (!Array.isArray(serializedMessages) || serializedMessages.length == 0) return null;

  let lastMessage = serializedMessages[serializedMessages.length - 1];
  if (!Array.isArray(lastMessage) || !isRecord(lastMessage[1])) return null;

  let content = lastMessage[1].content;
  if (!Array.isArray(content)) return null;

  let parts: MessagePart[] = [];

  for (let part of content) {
    if (!isRecord(part) || typeof part.type != 'string') continue;

    if (part.type == 'text' && typeof part.text == 'string') {
      parts.push({
        type: 'text',
        text: part.text
      });
      continue;
    }

    if (
      part.type == 'file' &&
      typeof part.data == 'string' &&
      typeof part.mediaType == 'string'
    ) {
      parts.push({
        type: 'file',
        data: part.data,
        mediaType: part.mediaType,
        encoding: 'base64',
        filename: typeof part.filename == 'string' ? part.filename : undefined
      });
    }
  }

  if (!parts.length) return null;

  return {
    id: `${message.id}:serialized`,
    type: 'message',
    status: 'completed',
    message: {
      role: message.type == 'assistant' ? 'assistant' : 'user',
      parts
    }
  };
};

export let getTranscriptEntries = (
  messages: AssistantConversationMessage[],
  liveState?: AssistantLiveState | null
): AssistantTranscriptEntry[] => {
  let entries: AssistantTranscriptEntry[] = [];

  for (let message of messages) {
    let items = getStateItems(message);
    if (!items.length) {
      let fallbackItem = getSerializedMessageItem(message);
      if (fallbackItem) items = [fallbackItem];
    }

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
