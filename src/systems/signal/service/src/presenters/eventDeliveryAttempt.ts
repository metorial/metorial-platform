import { addMilliseconds } from 'date-fns';
import type {
  Event,
  EventDeliveryAttempt,
  EventDeliveryIntent,
  EventDestination,
  EventDestinationInstance,
  Sender,
  WebhookDestinationWebhook
} from '../../prisma/generated/client';
import { env } from '../env';
import { storageKey } from '../lib/storageKey';
import { storage } from '../storage';
import { eventDeliveryIntentPresenter } from './eventDeliveryIntent';

export let eventDeliveryAttemptPresenter = async (
  attempt: EventDeliveryAttempt & {
    intent: EventDeliveryIntent & {
      event: Event & {
        sender: Sender;
      };
      destination: EventDestination;
    };
    destinationInstance: EventDestinationInstance & {
      webhook: WebhookDestinationWebhook | null;
    };
  },
  { includePayload }: { includePayload: boolean }
) => {
  let payload: { body: string; headers: [string, string][] } | null = null;

  if (includePayload) {
    try {
      let payloadRaw = await storage.getObject(
        env.storage.LOGS_BUCKET_NAME,
        storageKey.attempt(attempt)
      );
      payload = JSON.parse(payloadRaw.data.toString('utf-8'));
    } catch (err) {
      console.warn(`Failed to parse payload for attempt ${attempt.id}:`, err);
    }
  }

  return {
    object: 'signal#event.delivery_attempt',

    id: attempt.id,
    status: attempt.status,

    attemptNumber: attempt.attemptNumber,
    durationMs: attempt.durationMs,

    error: attempt.errorCode
      ? {
          code: attempt.errorCode,
          message: attempt.errorMessage ?? attempt.errorCode
        }
      : null,

    response: attempt.responseStatusCode
      ? {
          statusCode: attempt.responseStatusCode,
          body: payload?.body ?? null,
          headers: payload?.headers
            ? payload.headers.map(([key, value]) => ({ key, value }))
            : null
        }
      : null,

    intent: await eventDeliveryIntentPresenter(
      {
        ...attempt.intent,
        destination: {
          ...attempt.intent.destination,
          currentInstance: attempt.destinationInstance
        }
      },
      { includePayload }
    ),

    createdAt: attempt.createdAt,
    startedAt: attempt.createdAt,
    completedAt: addMilliseconds(attempt.createdAt, attempt.durationMs)
  };
};
