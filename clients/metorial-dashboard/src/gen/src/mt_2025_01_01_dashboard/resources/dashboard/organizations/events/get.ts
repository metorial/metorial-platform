import { mtMap } from '@metorial/util-resource-mapper';

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
  mtMap.object<DashboardOrganizationsEventsGetOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    organizationId: mtMap.objectField('organization_id', mtMap.passthrough()),
    instanceId: mtMap.objectField('instance_id', mtMap.passthrough()),
    source: mtMap.objectField('source', mtMap.passthrough()),
    eventType: mtMap.objectField('event_type', mtMap.passthrough()),
    callbackId: mtMap.objectField('callback_id', mtMap.passthrough()),
    callbackEventId: mtMap.objectField(
      'callback_event_id',
      mtMap.passthrough()
    ),
    callbackTriggerKey: mtMap.objectField(
      'callback_trigger_key',
      mtMap.passthrough()
    ),
    chatEventId: mtMap.objectField('chat_event_id', mtMap.passthrough()),
    chatConnectionId: mtMap.objectField(
      'chat_connection_id',
      mtMap.passthrough()
    ),
    providerId: mtMap.objectField('provider_id', mtMap.passthrough()),
    createdAt: mtMap.objectField('created_at', mtMap.date()),
    payload: mtMap.objectField('payload', mtMap.passthrough())
  });

