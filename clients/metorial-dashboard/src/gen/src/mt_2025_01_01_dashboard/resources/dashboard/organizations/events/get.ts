import { mapObject } from '@metorial/util-resource-mapper/compact';

export type DashboardOrganizationsEventsGetOutput = {
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
  payload: Record<string, any> | null;
};

export let mapDashboardOrganizationsEventsGetOutput =
  /* @__PURE__ */ mapObject<DashboardOrganizationsEventsGetOutput>(
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
    ],
    1
  );
