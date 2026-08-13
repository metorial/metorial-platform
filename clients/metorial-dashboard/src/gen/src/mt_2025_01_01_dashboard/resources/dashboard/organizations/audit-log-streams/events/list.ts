import { mtMap } from '@metorial/util-resource-mapper';

export type DashboardOrganizationsAuditLogStreamsEventsListOutput = {
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
      | 'disabled';
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

export let mapDashboardOrganizationsAuditLogStreamsEventsListOutput =
  mtMap.object<DashboardOrganizationsAuditLogStreamsEventsListOutput>({
    items: mtMap.objectField(
      'items',
      mtMap.array(
        mtMap.object({
          object: mtMap.objectField('object', mtMap.passthrough()),
          id: mtMap.objectField('id', mtMap.passthrough()),
          auditLogStreamId: mtMap.objectField(
            'audit_log_stream_id',
            mtMap.passthrough()
          ),
          type: mtMap.objectField('type', mtMap.passthrough()),
          message: mtMap.objectField('message', mtMap.passthrough()),
          errorDetails: mtMap.objectField(
            'error_details',
            mtMap.object({
              provider: mtMap.objectField('provider', mtMap.passthrough()),
              code: mtMap.objectField('code', mtMap.passthrough()),
              errorName: mtMap.objectField('error_name', mtMap.passthrough()),
              httpStatusCode: mtMap.objectField(
                'http_status_code',
                mtMap.passthrough()
              ),
              httpStatusText: mtMap.objectField(
                'http_status_text',
                mtMap.passthrough()
              ),
              providerErrorCode: mtMap.objectField(
                'provider_error_code',
                mtMap.passthrough()
              ),
              responseBody: mtMap.objectField(
                'response_body',
                mtMap.passthrough()
              ),
              batchIdentifier: mtMap.objectField(
                'batch_identifier',
                mtMap.passthrough()
              ),
              batchNumber: mtMap.objectField(
                'batch_number',
                mtMap.passthrough()
              ),
              successfulBatchCount: mtMap.objectField(
                'successful_batch_count',
                mtMap.passthrough()
              ),
              eventCount: mtMap.objectField('event_count', mtMap.passthrough()),
              firstEventId: mtMap.objectField(
                'first_event_id',
                mtMap.passthrough()
              ),
              lastEventId: mtMap.objectField(
                'last_event_id',
                mtMap.passthrough()
              )
            })
          ),
          createdAt: mtMap.objectField('created_at', mtMap.date())
        })
      )
    ),
    pagination: mtMap.objectField(
      'pagination',
      mtMap.object({
        hasMoreBefore: mtMap.objectField(
          'has_more_before',
          mtMap.passthrough()
        ),
        hasMoreAfter: mtMap.objectField('has_more_after', mtMap.passthrough())
      })
    )
  });

export type DashboardOrganizationsAuditLogStreamsEventsListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & {};

export let mapDashboardOrganizationsAuditLogStreamsEventsListQuery =
  mtMap.union([
    mtMap.unionOption(
      'object',
      mtMap.object({
        limit: mtMap.objectField('limit', mtMap.passthrough()),
        after: mtMap.objectField('after', mtMap.passthrough()),
        before: mtMap.objectField('before', mtMap.passthrough()),
        cursor: mtMap.objectField('cursor', mtMap.passthrough()),
        order: mtMap.objectField('order', mtMap.passthrough())
      })
    )
  ]);

