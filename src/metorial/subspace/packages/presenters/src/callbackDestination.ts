import type { CallbackDestination } from '@metorial-subspace/db';

type EnrichedCallbackDestination = CallbackDestination & {
  signalDestination?: {
    id: string;
    webhook: {
      id: string;
      url: string;
      method: string;
      signingSecretConfigured: boolean;
      createdAt: Date;
    } | null;
  } | null;
};

export let callbackDestinationPresenter = (
  callbackDestination: EnrichedCallbackDestination
) => ({
  object: 'callback.destination',

  id: callbackDestination.id,
  status: callbackDestination.status,
  signalDestinationId: callbackDestination.signalEventDestinationId,

  name: callbackDestination.name,
  description: callbackDestination.description,
  metadata: callbackDestination.metadata,

  url: callbackDestination.url,
  method: callbackDestination.method,
  webhook: callbackDestination.signalDestination?.webhook
    ? {
        id: callbackDestination.signalDestination.webhook.id,
        url: callbackDestination.signalDestination.webhook.url,
        method: callbackDestination.signalDestination.webhook.method,
        signingSecretConfigured:
          callbackDestination.signalDestination.webhook.signingSecretConfigured,
        createdAt: callbackDestination.signalDestination.webhook.createdAt
      }
    : null,

  createdAt: callbackDestination.createdAt,
  updatedAt: callbackDestination.updatedAt
});
