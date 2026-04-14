import type {
  EventDestination,
  EventDestinationInstance,
  WebhookDestinationWebhook
} from '../../prisma/generated/client';

export let eventDestinationPresenter = (
  eventDestination: EventDestination & {
    currentInstance:
      | (EventDestinationInstance & {
          webhook: WebhookDestinationWebhook | null;
        })
      | null;
  }
) => ({
  object: 'signal#event_destination',

  id: eventDestination.id,
  name: eventDestination.name,
  description: eventDestination.description,

  type: eventDestination.type,
  eventTypes: eventDestination.hasEventTypesFilter ? eventDestination.eventTypes : null,

  retry: {
    type: eventDestination.retryType,
    maxAttempts: eventDestination.retryMaxAttempts,
    delaySeconds: eventDestination.retryDelaySeconds
  },

  webhook: eventDestination.currentInstance?.webhook
    ? {
        object: 'signal#event_destination.webhook',
        id: eventDestination.currentInstance.webhook.id,

        url: eventDestination.currentInstance.webhook.url,
        method: eventDestination.currentInstance.webhook.method,

        signingSecret: eventDestination.currentInstance.webhook.signingSecret,

        createdAt: eventDestination.currentInstance.webhook.createdAt
      }
    : null,

  createdAt: eventDestination.createdAt,
  updatedAt: eventDestination.updatedAt
});
