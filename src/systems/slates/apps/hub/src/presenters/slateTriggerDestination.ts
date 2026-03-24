import type { SlateTriggerDestination } from '../../prisma/generated/client';

export let slateTriggerDestinationPresenter = (destination: SlateTriggerDestination) => ({
  object: 'slate.trigger.destination',

  id: destination.id,
  name: destination.name,
  description: destination.description,

  type: destination.type,
  status: destination.status,
  url: destination.url,
  method: destination.method,
  eventTypes: destination.eventTypes,
  signalDestinationId: destination.signalDestinationId,

  createdAt: destination.createdAt,
  updatedAt: destination.updatedAt
});
