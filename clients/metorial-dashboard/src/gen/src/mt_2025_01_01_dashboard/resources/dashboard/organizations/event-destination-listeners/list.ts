import { createMapper } from '@metorial/util-resource-mapper/compact';

export type DashboardOrganizationsEventDestinationListenersListOutput = {
  items: {
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
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapDashboardOrganizationsEventDestinationListenersListOutput =
  /* @__PURE__ */ createMapper<DashboardOrganizationsEventDestinationListenersListOutput>(
    [
      7,
      [
        1,
        [
          'instance_id',
          'event_destination_id',
          'event_types',
          'callback_id',
          'chat_connection_id',
          'provider_id',
          'created_at',
          'updated_at'
        ]
      ]
    ],
    1
  );

export type DashboardOrganizationsEventDestinationListenersListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & {
  eventDestinationId?: string | string[] | undefined;
  instanceId?: string | string[] | undefined;
  callbackId?: string | string[] | undefined;
  chatConnectionId?: string | string[] | undefined;
  providerId?: string | string[] | undefined;
  type?:
    | 'event'
    | 'callback'
    | 'chat'
    | ('event' | 'callback' | 'chat')[]
    | undefined;
};

export let mapDashboardOrganizationsEventDestinationListenersListQuery =
  /* @__PURE__ */ createMapper<DashboardOrganizationsEventDestinationListenersListQuery>(
    [
      3,
      [
        [
          0,
          [
            1,
            [
              'event_destination_id',
              'instance_id',
              'callback_id',
              'chat_connection_id',
              'provider_id'
            ]
          ]
        ]
      ]
    ]
  );
