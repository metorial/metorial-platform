import { mtMap } from '@metorial/util-resource-mapper';

export type DashboardOrganizationsConfigureAuditLogRetentionUpdateOutput = {
  object: 'organization.audit_log_retention_configuration';
  organizationId: string;
  auditLogRetentionInDays: number | null;
  updatedAt: Date;
};

export let mapDashboardOrganizationsConfigureAuditLogRetentionUpdateOutput =
  mtMap.object<DashboardOrganizationsConfigureAuditLogRetentionUpdateOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    organizationId: mtMap.objectField('organization_id', mtMap.passthrough()),
    auditLogRetentionInDays: mtMap.objectField(
      'audit_log_retention_in_days',
      mtMap.passthrough()
    ),
    updatedAt: mtMap.objectField('updated_at', mtMap.date())
  });
export type DashboardOrganizationsConfigureAuditLogRetentionUpdateBody = {
  auditLogRetentionInDays: number;
};

export let mapDashboardOrganizationsConfigureAuditLogRetentionUpdateBody =
  mtMap.object<DashboardOrganizationsConfigureAuditLogRetentionUpdateBody>({
    auditLogRetentionInDays: mtMap.objectField(
      'audit_log_retention_in_days',
      mtMap.passthrough()
    )
  });
