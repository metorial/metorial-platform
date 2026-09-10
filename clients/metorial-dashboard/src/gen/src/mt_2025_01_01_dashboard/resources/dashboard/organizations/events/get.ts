import { mtMap } from '@metorial/util-resource-mapper';

export type DashboardOrganizationsEventsGetOutput = {
  object: 'event';
  id: string;
  organizationId: string;
  instanceId: string | null;
  source: 'resource' | 'callback';
  eventType: string;
  payload: Record<string, any> | null;
  callbackId: string | null;
  callbackTriggerKey: string | null;
  createdAt: Date;
};

export let mapDashboardOrganizationsEventsGetOutput =
  mtMap.object<DashboardOrganizationsEventsGetOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    organizationId: mtMap.objectField('organization_id', mtMap.passthrough()),
    instanceId: mtMap.objectField('instance_id', mtMap.passthrough()),
    source: mtMap.objectField('source', mtMap.passthrough()),
    eventType: mtMap.objectField('event_type', mtMap.passthrough()),
    payload: mtMap.objectField('payload', mtMap.passthrough()),
    callbackId: mtMap.objectField('callback_id', mtMap.passthrough()),
    callbackTriggerKey: mtMap.objectField(
      'callback_trigger_key',
      mtMap.passthrough()
    ),
    createdAt: mtMap.objectField('created_at', mtMap.date())
  });

