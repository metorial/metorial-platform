import type { CallbackDestination } from '@metorial-subspace/db';

export let callbackDestinationPresenter = (callbackDestination: CallbackDestination) => ({
  object: 'callback.destination',

  id: callbackDestination.id,
  status: callbackDestination.status,

  name: callbackDestination.name,
  description: callbackDestination.description,
  metadata: callbackDestination.metadata,

  url: callbackDestination.url,
  method: callbackDestination.method,

  createdAt: callbackDestination.createdAt,
  updatedAt: callbackDestination.updatedAt
});
