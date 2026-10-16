import {
  createMapper,
  mapObject
} from '@metorial/util-resource-mapper/compact';

export type DashboardOrganizationsEventDestinationListenersCreateOutput = {
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

export let mapDashboardOrganizationsEventDestinationListenersCreateOutput =
  /* @__PURE__ */ mapObject<DashboardOrganizationsEventDestinationListenersCreateOutput>(
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

export type DashboardOrganizationsEventDestinationListenersCreateBody =
  | {
      instanceId: string;
      eventDestinationId: string;
      type: 'event';
      eventTypes: string[];
    }
  | {
      instanceId: string;
      eventDestinationId: string;
      type: 'callback';
      callbackId?: string | undefined;
      providerId?: string | undefined;
      triggers: string[];
    }
  | {
      instanceId: string;
      eventDestinationId: string;
      type: 'chat';
      chatConnectionId?: string | undefined;
      providerId?: string | undefined;
      eventTypes: string[];
    };

export let mapDashboardOrganizationsEventDestinationListenersCreateBody =
  /* @__PURE__ */ createMapper<DashboardOrganizationsEventDestinationListenersCreateBody>(
    [
      3,
      [
        [
          0,
          [
            1,
            [
              'instance_id',
              'event_destination_id',
              'event_types',
              'callback_id',
              'provider_id',
              'chat_connection_id'
            ]
          ]
        ]
      ]
    ]
  );
