import type { SystemEvent } from '@metorial/db';
import { getEventPayload } from '../storage';

export let resolveSystemEventPayload = async (
  event: Pick<SystemEvent, 'payloadJson' | 'payloadStorageKey'>
): Promise<Record<string, any> | null> => {
  if (event.payloadJson) return event.payloadJson as Record<string, any>;
  if (!event.payloadStorageKey) return null;

  let object = await getEventPayload(event.payloadStorageKey);
  return JSON.parse(object.data.toString('utf-8'));
};
