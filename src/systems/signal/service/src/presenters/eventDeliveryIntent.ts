import type {
  Event,
  EventDeliveryIntent,
  EventDestination,
  EventDestinationInstance,
  Sender,
  WebhookDestinationWebhook
} from '../../prisma/generated/client';
import { eventPresenter } from './event';
import { eventDestinationPresenter } from './eventDestination';

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
  { includePayload }: { includePayload: boolean }
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

    createdAt: intent.createdAt,
    updatedAt: intent.updatedAt,
    lastAttemptAt: intent.lastAttemptAt,
    nextAttemptAt: intent.nextAttemptAt
  };
};
