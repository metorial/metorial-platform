import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { auditLogStreamType } from '../../types';

export let v1AuditLogStreamPresenter = Presenter.create(auditLogStreamType)
  .presenter(async ({ auditLogStream }) => ({
    object: 'organization.audit_log_stream',
    id: auditLogStream.id,
    organization_id: auditLogStream.organization.id,
    provider: auditLogStream.provider,
    status: auditLogStream.status,
    error_message: auditLogStream.errorMessage ?? null,
    provider_data: auditLogStream.providerDataRedacted,
    created_at: auditLogStream.createdAt,
    updated_at: auditLogStream.updatedAt
  }))
  .schema(
    v.object({
      object: v.literal('organization.audit_log_stream'),
      id: v.string(),
      organization_id: v.string(),
      provider: v.enumOf(['datadog', 'splunk']),
      status: v.enumOf(['active', 'inactive']),
      error_message: v.nullable(v.string()),
      provider_data: v.record(v.any()),
      created_at: v.date(),
      updated_at: v.date()
    })
  )
  .build();

export let dashboardAuditLogStreamPresenter = Presenter.create(auditLogStreamType)
  .presenter(async ({ auditLogStream }) => ({
    object: 'organization.audit_log_stream',
    id: auditLogStream.id,
    organization_id: auditLogStream.organization.id,
    provider: auditLogStream.provider,
    status: auditLogStream.status,
    access_status: auditLogStream.accessStatus,
    is_paused_due_to_error: auditLogStream.isPausedDueToError,
    error_message: auditLogStream.errorMessage ?? null,
    consecutive_error_count: auditLogStream.consecutiveErrorCount,
    is_started: auditLogStream.isStarted,
    provider_data: auditLogStream.providerDataRedacted,
    created_at: auditLogStream.createdAt,
    updated_at: auditLogStream.updatedAt
  }))
  .schema(
    v.object({
      object: v.literal('organization.audit_log_stream'),
      id: v.string(),
      organization_id: v.string(),
      provider: v.enumOf(['datadog', 'splunk']),
      status: v.enumOf(['active', 'inactive']),
      access_status: v.enumOf(['ok', 'error']),
      is_paused_due_to_error: v.boolean(),
      error_message: v.nullable(v.string()),
      consecutive_error_count: v.number(),
      is_started: v.boolean(),
      provider_data: v.record(v.any()),
      created_at: v.date(),
      updated_at: v.date()
    })
  )
  .build();
