import { createMapper } from '@metorial/util-resource-mapper/compact';

export type DashboardOrganizationsEventsListOutput = {
  items: {
    object: 'event';
    id: string;
    organizationId: string;
    instanceId: string | null;
    source: 'resource' | 'callback' | 'chat' | 'ping';
    eventType: string;
    callbackId: string | null;
    callbackEventId: string | null;
    callbackTriggerKey: string | null;
    chatEventId: string | null;
    chatConnectionId: string | null;
    providerId: string | null;
    createdAt: Date;
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapDashboardOrganizationsEventsListOutput =
  /* @__PURE__ */ createMapper<DashboardOrganizationsEventsListOutput>(
    [
      7,
      [
        1,
        [
          'organization_id',
          'instance_id',
          'event_type',
          'callback_id',
          'callback_event_id',
          'callback_trigger_key',
          'chat_event_id',
          'chat_connection_id',
          'provider_id',
          'created_at'
        ]
      ]
    ],
    1
  );

export type DashboardOrganizationsEventsListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & {
  instanceId?: string | undefined;
  eventType?: string | string[] | undefined;
  source?:
    | 'resource'
    | 'callback'
    | 'chat'
    | 'ping'
    | ('resource' | 'callback' | 'chat' | 'ping')[]
    | undefined;
  callbackId?: string | string[] | undefined;
  callbackTriggerKey?: string | string[] | undefined;
  chatConnectionId?: string | string[] | undefined;
  providerId?: string | string[] | undefined;
  createdAt?: { gt?: Date | undefined; lt?: Date | undefined } | undefined;
};

export let mapDashboardOrganizationsEventsListQuery =
  /* @__PURE__ */ createMapper<DashboardOrganizationsEventsListQuery>([
    3,
    [
      [
        0,
        [
          1,
          [
            'instance_id',
            'event_type',
            'callback_id',
            'callback_trigger_key',
            'chat_connection_id',
            'provider_id',
            ['created_at', 1, 5]
          ]
        ]
      ]
    ]
  ]);
