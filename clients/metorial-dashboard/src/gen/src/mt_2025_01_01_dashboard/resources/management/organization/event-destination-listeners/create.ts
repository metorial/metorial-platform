import {
  createMapper,
  mapObject
} from '@metorial/util-resource-mapper/compact';

export type ManagementOrganizationEventDestinationListenersCreateOutput = {
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

export let mapManagementOrganizationEventDestinationListenersCreateOutput =
  /* @__PURE__ */ mapObject<ManagementOrganizationEventDestinationListenersCreateOutput>(
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

export type ManagementOrganizationEventDestinationListenersCreateBody =
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

export let mapManagementOrganizationEventDestinationListenersCreateBody =
  /* @__PURE__ */ createMapper<ManagementOrganizationEventDestinationListenersCreateBody>(
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
