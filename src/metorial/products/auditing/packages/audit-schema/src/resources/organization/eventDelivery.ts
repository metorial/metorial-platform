import { v } from '@lowerdeck/validation';
import { resource } from '../../_lib/resource';

export let eventDeliveryResource = resource({
  name: 'event_delivery',
  payload: v.typedAny<{
    id: string;
    eventId: string;
    eventType: string;
    eventDestinationId: string;
    status: string;
    attemptCount: number;
  }>('event_delivery'),
  presenter: undefined,
  actions: {
    retry: true
  }
});
