import type {
  Callback,
  CallbackDestinationLink,
  EventDestination,
  EventDestinationInstance,
  WebhookDestinationWebhook
} from '../../prisma/generated/client';
import { eventDestinationPresenter } from './eventDestination';

export let callbackPresenter = (
  callback: Callback & {
    destinations: (CallbackDestinationLink & {
      eventDestination: EventDestination & {
        currentInstance:
          | (EventDestinationInstance & {
              webhook: WebhookDestinationWebhook | null;
            })
          | null;
      };
    })[];
  }
) => ({
  object: 'signal#callback',

  id: callback.id,
  status: callback.status,
  name: callback.name,
  description: callback.description,
  eventTypes: callback.hasEventTypesFilter ? callback.eventTypes : null,

  destinations: callback.destinations.map(link => ({
    object: 'signal#callback.destination',
    status: link.status,
    destination: eventDestinationPresenter(link.eventDestination)
  })),

  createdAt: callback.createdAt,
  updatedAt: callback.updatedAt,
  archivedAt: callback.archivedAt
});
