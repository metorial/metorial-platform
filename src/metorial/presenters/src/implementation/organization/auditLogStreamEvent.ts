import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { auditLogStreamEventType } from '../../types';

export let v1AuditLogStreamEventPresenter = Presenter.create(auditLogStreamEventType)
  .presenter(async ({ auditLogStreamEvent }) => ({
    object: 'organization.audit_log_stream.event',
    id: auditLogStreamEvent.id,
    audit_log_stream_id: auditLogStreamEvent.auditLogStream.id,
    type: auditLogStreamEvent.type,
    message: auditLogStreamEvent.message ?? null,
    created_at: auditLogStreamEvent.createdAt
  }))
  .schema(
    v.object({
      object: v.literal('organization.audit_log_stream.event'),
      id: v.string(),
      audit_log_stream_id: v.string(),
      type: v.enumOf(['created', 'started', 'error', 'error_paused', 'recovered', 'disabled']),
      message: v.nullable(v.string()),
      created_at: v.date()
    })
  )
  .build();
