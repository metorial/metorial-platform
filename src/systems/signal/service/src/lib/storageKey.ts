import type { Event, EventDeliveryAttempt } from '../../prisma/generated/client';

export let storageKey = {
  event: (event: Event) => `events/${event.oid}/data`,
  attempt: (attempt: EventDeliveryAttempt) => `attempts/${attempt.oid}/data`
};
