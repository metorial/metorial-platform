import { mapObject } from '@metorial/util-resource-mapper/compact';

export type DashboardOrganizationsAuditLogsGetOutput = {
  object: 'organization.audit_log';
  id: string;
  eventId: string;
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

export let mapDashboardOrganizationsAuditLogsGetOutput =
  /* @__PURE__ */ mapObject<DashboardOrganizationsAuditLogsGetOutput>(
    [
      'event_id',
      'organization_id',
      'instance_id',
      'organization_actor_id',
      'previous_attributes',
      'recorded_at'
    ],
    1
  );
