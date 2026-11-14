import type {
  Callback,
  CallbackEvent,
  CallbackEventStatus,
  Event,
  Sender
} from '../../prisma/generated/client';
import { env } from '../env';
import { storage } from '../storage';

let readPayload = async (payloadJson: string | null, storageKey: string | null) => {
  if (payloadJson !== null) return JSON.parse(payloadJson);
  if (!storageKey) return null;

  try {
    let payloadRaw = await storage.getObject(env.storage.LOGS_BUCKET_NAME, storageKey);
    return JSON.parse(payloadRaw.data.toString('utf-8'));
  } catch (error) {
    console.warn(`Failed to read callback event payload ${storageKey}:`, error);
    return null;
  }
};

let getDeliveryStatus = (event: Event) =>
  event.status === 'delivered' ? 'sent' : event.status === 'failed' ? 'failed' : 'pending';

let getLifecycleDeliveryStatus = (status: CallbackEventStatus) => {
  if (status === 'failed') return 'failed';
  if (status === 'skipped') return 'skipped';
  if (status === 'succeeded') return null;
  return 'pending';
};

export let callbackEventPresenter = async (
  callbackEvent: CallbackEvent & {
    callback: Callback;
    event:
      | (Event & {
          sender: Sender;
          callback?: Callback | null;
        })
      | null;
  },
  { includePayload }: { includePayload: boolean }
) => ({
  object: 'signal#callback.event',

  id: callbackEvent.id,
  externalId: callbackEvent.externalId,
  eventId: callbackEvent.event?.id ?? null,
  type: callbackEvent.type,
  sourceId: callbackEvent.sourceId,
  triggerId: callbackEvent.triggerId,
  triggerKey: callbackEvent.triggerKey,
  idempotencyKey: callbackEvent.idempotencyKey,
  status: callbackEvent.status,
  error:
    callbackEvent.errorCode || callbackEvent.errorMessage
      ? {
          code: callbackEvent.errorCode,
          message: callbackEvent.errorMessage
        }
      : null,

  input: includePayload
    ? await readPayload(callbackEvent.inputJson, callbackEvent.inputStorageKey)
    : null,
  output: includePayload
    ? await readPayload(callbackEvent.outputJson, callbackEvent.outputStorageKey)
    : null,
  deliveryStatus: callbackEvent.event
    ? getDeliveryStatus(callbackEvent.event)
    : getLifecycleDeliveryStatus(callbackEvent.status),

  callbackId: callbackEvent.callback.id,
  callbackInstanceId: callbackEvent.callbackInstanceId,

  createdAt: callbackEvent.createdAt,
  updatedAt: callbackEvent.updatedAt
});
