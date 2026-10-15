import { mapObject } from '@metorial/util-resource-mapper/compact';

export type DashboardOrganizationsAuditLogStreamsEventsGetOutput = {
  object: 'organization.audit_log_stream.event';
  id: string;
  auditLogStreamId: string;
  type:
    | 'created'
    | 'started'
    | 'error'
    | 'error_paused'
    | 'recovered'
    | 'disabled'
    | 'enabled';
  message: string | null;
  errorDetails: {
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
  } | null;
  createdAt: Date;
};

export let mapDashboardOrganizationsAuditLogStreamsEventsGetOutput =
  /* @__PURE__ */ mapObject<DashboardOrganizationsAuditLogStreamsEventsGetOutput>(
    [
      'audit_log_stream_id',
      [
        'error_details',
        1,
        [
          1,
          [
            'error_name',
            'http_status_code',
            'http_status_text',
            'provider_error_code',
            'response_body',
            'batch_identifier',
            'batch_number',
            'successful_batch_count',
            'event_count',
            'first_event_id',
            'last_event_id'
          ]
        ]
      ],
      'created_at'
    ],
    1
  );
