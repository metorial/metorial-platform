import { mtMap } from '@metorial/util-resource-mapper';

export type DashboardOrganizationsConfigureAuditLogRetentionGetOutput = {
  object: 'organization.audit_log_retention_configuration';
  organizationId: string;
  auditLogRetentionInDays: number | null;
  updatedAt: Date;
};

export let mapDashboardOrganizationsConfigureAuditLogRetentionGetOutput =
  mtMap.object<DashboardOrganizationsConfigureAuditLogRetentionGetOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    organizationId: mtMap.objectField('organization_id', mtMap.passthrough()),
    auditLogRetentionInDays: mtMap.objectField(
      'audit_log_retention_in_days',
      mtMap.passthrough()
    ),
    updatedAt: mtMap.objectField('updated_at', mtMap.date())
  });

