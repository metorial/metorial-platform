import { mapObject } from '@metorial/util-resource-mapper/compact';

export type DashboardOrganizationsConfigureAuditLogRetentionGetOutput = {
  object: 'organization.audit_log_retention_configuration';
  organizationId: string;
  auditLogRetentionInDays: number | null;
  updatedAt: Date;
};

export let mapDashboardOrganizationsConfigureAuditLogRetentionGetOutput =
  /* @__PURE__ */ mapObject<DashboardOrganizationsConfigureAuditLogRetentionGetOutput>(
    ['organization_id', 'audit_log_retention_in_days', 'updated_at'],
    1
  );
