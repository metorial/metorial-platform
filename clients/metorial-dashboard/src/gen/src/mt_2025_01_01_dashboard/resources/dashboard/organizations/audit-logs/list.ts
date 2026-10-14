import { createMapper } from '@metorial/util-resource-mapper/compact';

export type DashboardOrganizationsAuditLogsListOutput = {
  items: {
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
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapDashboardOrganizationsAuditLogsListOutput =
  /* @__PURE__ */ createMapper<DashboardOrganizationsAuditLogsListOutput>(
    [
      7,
      [
        1,
        [
          'event_id',
          'organization_id',
          'instance_id',
          'organization_actor_id',
          'previous_attributes',
          'recorded_at'
        ]
      ]
    ],
    1
  );

export type DashboardOrganizationsAuditLogsListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & {};

export let mapDashboardOrganizationsAuditLogsListQuery =
  /* @__PURE__ */ createMapper<DashboardOrganizationsAuditLogsListQuery>(0);
