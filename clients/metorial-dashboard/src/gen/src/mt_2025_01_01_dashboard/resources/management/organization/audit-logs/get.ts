import { mtMap } from '@metorial/util-resource-mapper';

export type ManagementOrganizationAuditLogsGetOutput = {
  object: 'organization.audit_log';
  id: string;
  eventId: string | null;
  resource: string;
  action: string;
  organizationId: string;
  instanceId: string | null;
  organizationActorId: string | null;
  actor: {
    type: string;
    id: string | null;
    metadata: Record<string, any> | null;
    record: any | null;
  } | null;
  context: { ip: string | null; ua: string | null };
  payload: Record<string, any> | null;
  previousAttributes: Record<string, any> | null;
  recordedAt: Date;
};

export let mapManagementOrganizationAuditLogsGetOutput =
  mtMap.object<ManagementOrganizationAuditLogsGetOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    eventId: mtMap.objectField('event_id', mtMap.passthrough()),
    resource: mtMap.objectField('resource', mtMap.passthrough()),
    action: mtMap.objectField('action', mtMap.passthrough()),
    organizationId: mtMap.objectField('organization_id', mtMap.passthrough()),
    instanceId: mtMap.objectField('instance_id', mtMap.passthrough()),
    organizationActorId: mtMap.objectField(
      'organization_actor_id',
      mtMap.passthrough()
    ),
    actor: mtMap.objectField(
      'actor',
      mtMap.object({
        type: mtMap.objectField('type', mtMap.passthrough()),
        id: mtMap.objectField('id', mtMap.passthrough()),
        metadata: mtMap.objectField('metadata', mtMap.passthrough()),
        record: mtMap.objectField('record', mtMap.passthrough())
      })
    ),
    context: mtMap.objectField(
      'context',
      mtMap.object({
        ip: mtMap.objectField('ip', mtMap.passthrough()),
        ua: mtMap.objectField('ua', mtMap.passthrough())
      })
    ),
    payload: mtMap.objectField('payload', mtMap.passthrough()),
    previousAttributes: mtMap.objectField(
      'previous_attributes',
      mtMap.passthrough()
    ),
    recordedAt: mtMap.objectField('recorded_at', mtMap.date())
  });

