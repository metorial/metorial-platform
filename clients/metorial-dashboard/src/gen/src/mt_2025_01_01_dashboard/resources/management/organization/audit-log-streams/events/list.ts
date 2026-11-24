import { createMapper } from '@metorial/util-resource-mapper/compact';

export type ManagementOrganizationAuditLogStreamsEventsListOutput = {
  items: {
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
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapManagementOrganizationAuditLogStreamsEventsListOutput =
  /* @__PURE__ */ createMapper<ManagementOrganizationAuditLogStreamsEventsListOutput>(
    [
      7,
      [
        1,
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
        ]
      ]
    ],
    1
  );

export type ManagementOrganizationAuditLogStreamsEventsListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & {};

export let mapManagementOrganizationAuditLogStreamsEventsListQuery =
  /* @__PURE__ */ createMapper<ManagementOrganizationAuditLogStreamsEventsListQuery>(
    0
  );
