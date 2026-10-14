import { mapObject } from '@metorial/util-resource-mapper/compact';

export type DashboardOrganizationsConfigureAuditLogRetentionUpdateOutput = {
  object: 'organization.audit_log_retention_configuration';
  organizationId: string;
  auditLogRetentionInDays: number | null;
  updatedAt: Date;
};

export let mapDashboardOrganizationsConfigureAuditLogRetentionUpdateOutput =
  /* @__PURE__ */ mapObject<DashboardOrganizationsConfigureAuditLogRetentionUpdateOutput>(
    ['organization_id', 'audit_log_retention_in_days', 'updated_at'],
    1
  );

export type DashboardOrganizationsConfigureAuditLogRetentionUpdateBody = {
  auditLogRetentionInDays: number;
};

export let mapDashboardOrganizationsConfigureAuditLogRetentionUpdateBody =
  /* @__PURE__ */ mapObject<DashboardOrganizationsConfigureAuditLogRetentionUpdateBody>(
    ['audit_log_retention_in_days']
  );
