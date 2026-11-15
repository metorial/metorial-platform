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
import { eventPresenter } from './event';
import { eventDestinationPresenter } from './eventDestination';

let presentAttempt = async (
  attempt: EventDeliveryAttempt,
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

    createdAt: attempt.createdAt,
    startedAt: attempt.createdAt,
    completedAt: addMilliseconds(attempt.createdAt, attempt.durationMs)
  };
};

export let eventDeliveryIntentPresenter = async (
  intent: EventDeliveryIntent & {
    event: Event & {
      sender: Sender;
    };
    destination: EventDestination & {
      currentInstance:
        | (EventDestinationInstance & {
            webhook: WebhookDestinationWebhook | null;
          })
        | null;
    };
  },
  {
    includePayload,
    attempts
  }: {
    includePayload: boolean;
    attempts?: EventDeliveryAttempt[] | null;
  }
) => {
  return {
    object: 'signal#event.delivery_intent',

    id: intent.id,
    status: intent.status,

    error: intent.errorCode
      ? {
          code: intent.errorCode,
          message: intent.errorMessage ?? intent.errorCode
        }
      : null,

    attemptCount: intent.attemptCount,

    event: await eventPresenter(intent.event, { includePayload }),
    destination: eventDestinationPresenter(intent.destination),
    attempts: attempts
      ? await Promise.all(
          [...attempts]
            .sort((a, b) =>
              a.attemptNumber === b.attemptNumber
                ? a.createdAt.getTime() - b.createdAt.getTime()
                : a.attemptNumber - b.attemptNumber
            )
            .map(attempt => presentAttempt(attempt, { includePayload }))
        )
      : null,

    createdAt: intent.createdAt,
    updatedAt: intent.updatedAt,
    lastAttemptAt: intent.lastAttemptAt,
    nextAttemptAt:
      intent.status === 'delivered' || intent.status === 'failed' ? null : intent.nextAttemptAt
  };
};
