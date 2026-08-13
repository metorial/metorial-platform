import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { auditLogStreamEventType } from '../../types';

type AuditLogStreamErrorDetails = {
  provider: 'datadog' | 'splunk';
  code: 'http_error' | 'provider_error' | 'unknown_error';
  errorName: string;
  httpStatusCode: number | null;
  httpStatusText: string | null;
  providerErrorCode: string | null;
  responseBody: string | null;
  batchIdentifier: string;
  batchNumber: number;
  successfulBatchCount: number;
  eventCount: number;
  firstEventId: string | null;
  lastEventId: string | null;
};

export let v1AuditLogStreamEventPresenter = Presenter.create(auditLogStreamEventType)
  .presenter(async ({ auditLogStreamEvent }) => {
    let errorDetails =
      (auditLogStreamEvent.errorDetails as AuditLogStreamErrorDetails | null) ?? null;

    return {
      object: 'organization.audit_log_stream.event',
      id: auditLogStreamEvent.id,
      audit_log_stream_id: auditLogStreamEvent.auditLogStream.id,
      type: auditLogStreamEvent.type,
      message: auditLogStreamEvent.message ?? null,
      error_details: errorDetails
        ? {
            provider: errorDetails.provider,
            code: errorDetails.code,
            error_name: errorDetails.errorName,
            http_status_code: errorDetails.httpStatusCode,
            http_status_text: errorDetails.httpStatusText,
            provider_error_code: errorDetails.providerErrorCode,
            response_body: errorDetails.responseBody,
            batch_identifier: errorDetails.batchIdentifier,
            batch_number: errorDetails.batchNumber,
            successful_batch_count: errorDetails.successfulBatchCount,
            event_count: errorDetails.eventCount,
            first_event_id: errorDetails.firstEventId,
            last_event_id: errorDetails.lastEventId
          }
        : null,
      created_at: auditLogStreamEvent.createdAt
    };
  })
  .schema(
    v.object({
      object: v.literal('organization.audit_log_stream.event'),
      id: v.string(),
      audit_log_stream_id: v.string(),
      type: v.enumOf(['created', 'started', 'error', 'error_paused', 'recovered', 'disabled']),
      message: v.nullable(v.string()),
      error_details: v.nullable(
        v.object({
          provider: v.enumOf(['datadog', 'splunk']),
          code: v.enumOf(['http_error', 'provider_error', 'unknown_error']),
          error_name: v.string(),
          http_status_code: v.nullable(v.number()),
          http_status_text: v.nullable(v.string()),
          provider_error_code: v.nullable(v.string()),
          response_body: v.nullable(v.string()),
          batch_identifier: v.string(),
          batch_number: v.number(),
          successful_batch_count: v.number(),
          event_count: v.number(),
          first_event_id: v.nullable(v.string()),
          last_event_id: v.nullable(v.string())
        })
      ),
      created_at: v.date()
    })
  )
  .build();
