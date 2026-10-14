import { mapObject } from '@metorial/util-resource-mapper/compact';

export type DashboardOrganizationsEventDestinationListenersGetOutput = {
  object: 'event.destination_listener';
  id: string;
  instanceId: string;
  eventDestinationId: string;
  type: 'event' | 'callback' | 'chat';
  eventTypes: string[] | null;
  callbackId: string | null;
  triggers: string[] | null;
  chatConnectionId: string | null;
  providerId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export let mapDashboardOrganizationsEventDestinationListenersGetOutput =
  /* @__PURE__ */ mapObject<DashboardOrganizationsEventDestinationListenersGetOutput>(
    [
      'instance_id',
      'event_destination_id',
      'event_types',
      'callback_id',
      'chat_connection_id',
      'provider_id',
      'created_at',
      'updated_at'
    ],
    1
  );
