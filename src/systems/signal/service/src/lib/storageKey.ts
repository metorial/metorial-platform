import type { CallbackEvent, Event, EventDeliveryAttempt } from '../../prisma/generated/client';

export let storageKey = {
  event: (event: Event) => `events/${event.oid}/data`,
  callbackEventInput: (event: CallbackEvent) => `callback-events/${event.oid}/input`,
  callbackEventOutput: (event: CallbackEvent) => `callback-events/${event.oid}/output`,
  attempt: (attempt: EventDeliveryAttempt) => `attempts/${attempt.oid}/data`
};
