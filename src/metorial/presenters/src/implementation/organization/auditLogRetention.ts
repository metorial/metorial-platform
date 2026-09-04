import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { organizationAuditLogRetentionType } from '../../types';

export let v1OrganizationAuditLogRetentionPresenter = Presenter.create(
  organizationAuditLogRetentionType
)
  .presenter(async ({ organization }) => ({
    object: 'organization.audit_log_retention_configuration' as const,
    organization_id: organization.id,
    audit_log_retention_in_days: organization.auditLogRetentionInDays,
    updated_at: organization.updatedAt
  }))
  .schema(
    v.object({
      object: v.literal('organization.audit_log_retention_configuration'),
      organization_id: v.string(),
      audit_log_retention_in_days: v.nullable(v.number()),
      updated_at: v.date()
    })
  )
  .build();
