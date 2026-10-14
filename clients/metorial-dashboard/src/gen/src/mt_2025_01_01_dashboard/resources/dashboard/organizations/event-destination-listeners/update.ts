import { mapObject } from '@metorial/util-resource-mapper/compact';

export type DashboardOrganizationsEventDestinationListenersUpdateOutput = {
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

export let mapDashboardOrganizationsEventDestinationListenersUpdateOutput =
  /* @__PURE__ */ mapObject<DashboardOrganizationsEventDestinationListenersUpdateOutput>(
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

export type DashboardOrganizationsEventDestinationListenersUpdateBody = {
  eventTypes?: string[] | undefined;
  triggers?: string[] | undefined;
};

export let mapDashboardOrganizationsEventDestinationListenersUpdateBody =
  /* @__PURE__ */ mapObject<DashboardOrganizationsEventDestinationListenersUpdateBody>(
    ['event_types']
  );
