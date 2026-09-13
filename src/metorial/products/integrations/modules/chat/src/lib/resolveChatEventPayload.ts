import type { ChatEvent } from '@metorial-subspace/db';
import { getChatEventPayloadObject } from '../storage';

export let resolveChatEventPayload = async (
  chatEvent: Pick<ChatEvent, 'payload' | 'payloadStorageKey'>
): Promise<Record<string, any> | null> => {
  if (chatEvent.payload) return chatEvent.payload as Record<string, any>;
  if (!chatEvent.payloadStorageKey) return null;

  let object = await getChatEventPayloadObject(chatEvent.payloadStorageKey);
  return JSON.parse(object.data.toString('utf-8'));
};
