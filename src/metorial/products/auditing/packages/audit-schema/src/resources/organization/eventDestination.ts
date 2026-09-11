import { v } from '@lowerdeck/validation';
import { resource } from '../../_lib/resource';

export let eventDestinationResource = resource({
  name: 'event_destination',
  payload: v.typedAny<{
    id: string;
    name: string;
    description: string | null;
    status: string;
    type: string;
    webhookUrl: string | null;
    webhookMethod: string | null;
    createdAt: Date;
    updatedAt: Date;
  }>('event_destination'),
  presenter: undefined,
  actions: {
    create: true,
    update: true,
    archive: true
  }
});

export let eventDestinationListenerResource = resource({
  name: 'event_destination_listener',
  payload: v.typedAny<{
    id: string;
    eventDestinationId: string;
    type: string;
    eventTypes: string[];
    callbackId: string | null;
    triggers: string[];
    createdAt: Date;
    updatedAt: Date;
  }>('event_destination_listener'),
  presenter: undefined,
  actions: {
    create: true,
    update: true,
    delete: true
  }
});
