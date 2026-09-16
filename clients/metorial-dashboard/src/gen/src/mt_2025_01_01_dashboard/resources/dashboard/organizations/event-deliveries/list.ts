import { mtMap } from '@metorial/util-resource-mapper';

export type DashboardOrganizationsEventDeliveriesListOutput = {
  items: {
    object: 'event.delivery';
    id: string;
    organizationId: string;
    instanceId: string | null;
    eventId: string;
    eventType: string;
    eventDestinationId: string;
    type: 'webhook';
    status: 'pending' | 'retrying' | 'delivered' | 'failed' | 'cancelled';
    attemptCount: number;
    error: { code: string; message: string } | null;
    retry: {
      strategy: 'exponential' | 'linear' | 'fixed';
      maxAttempts: number;
      baseDelaySeconds: number;
      maxDelaySeconds: number;
    };
    attempts: {
      object: 'event.delivery_attempt';
      id: string;
      eventDeliveryId: string;
      eventId: string;
      eventDestinationId: string;
      status: 'succeeded' | 'failed';
      attemptNumber: number;
      durationMs: number;
      isRetryable: boolean;
      error: { code: string; message: string } | null;
      request: {
        url: string;
        method: string;
        headers: { key: string; value: string }[];
        body: string | null;
      } | null;
      response: {
        statusCode: number;
        headers: { key: string; value: string }[] | null;
        body: string | null;
        isBodyTruncated: boolean;
      } | null;
      startedAt: Date;
      completedAt: Date;
      createdAt: Date;
    }[];
    lastAttemptAt: Date | null;
    nextAttemptAt: Date | null;
    completedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapDashboardOrganizationsEventDeliveriesListOutput =
  mtMap.object<DashboardOrganizationsEventDeliveriesListOutput>({
    items: mtMap.objectField(
      'items',
      mtMap.array(
        mtMap.object({
          object: mtMap.objectField('object', mtMap.passthrough()),
          id: mtMap.objectField('id', mtMap.passthrough()),
          organizationId: mtMap.objectField(
            'organization_id',
            mtMap.passthrough()
          ),
          instanceId: mtMap.objectField('instance_id', mtMap.passthrough()),
          eventId: mtMap.objectField('event_id', mtMap.passthrough()),
          eventType: mtMap.objectField('event_type', mtMap.passthrough()),
          eventDestinationId: mtMap.objectField(
            'event_destination_id',
            mtMap.passthrough()
          ),
          type: mtMap.objectField('type', mtMap.passthrough()),
          status: mtMap.objectField('status', mtMap.passthrough()),
          attemptCount: mtMap.objectField('attempt_count', mtMap.passthrough()),
          error: mtMap.objectField(
            'error',
            mtMap.object({
              code: mtMap.objectField('code', mtMap.passthrough()),
              message: mtMap.objectField('message', mtMap.passthrough())
            })
          ),
          retry: mtMap.objectField(
            'retry',
            mtMap.object({
              strategy: mtMap.objectField('strategy', mtMap.passthrough()),
              maxAttempts: mtMap.objectField(
                'max_attempts',
                mtMap.passthrough()
              ),
              baseDelaySeconds: mtMap.objectField(
                'base_delay_seconds',
                mtMap.passthrough()
              ),
              maxDelaySeconds: mtMap.objectField(
                'max_delay_seconds',
                mtMap.passthrough()
              )
            })
          ),
          attempts: mtMap.objectField(
            'attempts',
            mtMap.array(
              mtMap.object({
                object: mtMap.objectField('object', mtMap.passthrough()),
                id: mtMap.objectField('id', mtMap.passthrough()),
                eventDeliveryId: mtMap.objectField(
                  'event_delivery_id',
                  mtMap.passthrough()
                ),
                eventId: mtMap.objectField('event_id', mtMap.passthrough()),
                eventDestinationId: mtMap.objectField(
                  'event_destination_id',
                  mtMap.passthrough()
                ),
                status: mtMap.objectField('status', mtMap.passthrough()),
                attemptNumber: mtMap.objectField(
                  'attempt_number',
                  mtMap.passthrough()
                ),
                durationMs: mtMap.objectField(
                  'duration_ms',
                  mtMap.passthrough()
                ),
                isRetryable: mtMap.objectField(
                  'is_retryable',
                  mtMap.passthrough()
                ),
                error: mtMap.objectField(
                  'error',
                  mtMap.object({
                    code: mtMap.objectField('code', mtMap.passthrough()),
                    message: mtMap.objectField('message', mtMap.passthrough())
                  })
                ),
                request: mtMap.objectField(
                  'request',
                  mtMap.object({
                    url: mtMap.objectField('url', mtMap.passthrough()),
                    method: mtMap.objectField('method', mtMap.passthrough()),
                    headers: mtMap.objectField(
                      'headers',
                      mtMap.array(
                        mtMap.object({
                          key: mtMap.objectField('key', mtMap.passthrough()),
                          value: mtMap.objectField('value', mtMap.passthrough())
                        })
                      )
                    ),
                    body: mtMap.objectField('body', mtMap.passthrough())
                  })
                ),
                response: mtMap.objectField(
                  'response',
                  mtMap.object({
                    statusCode: mtMap.objectField(
                      'status_code',
                      mtMap.passthrough()
                    ),
                    headers: mtMap.objectField(
                      'headers',
                      mtMap.array(
                        mtMap.object({
                          key: mtMap.objectField('key', mtMap.passthrough()),
                          value: mtMap.objectField('value', mtMap.passthrough())
                        })
                      )
                    ),
                    body: mtMap.objectField('body', mtMap.passthrough()),
                    isBodyTruncated: mtMap.objectField(
                      'is_body_truncated',
                      mtMap.passthrough()
                    )
                  })
                ),
                startedAt: mtMap.objectField('started_at', mtMap.date()),
                completedAt: mtMap.objectField('completed_at', mtMap.date()),
                createdAt: mtMap.objectField('created_at', mtMap.date())
              })
            )
          ),
          lastAttemptAt: mtMap.objectField('last_attempt_at', mtMap.date()),
          nextAttemptAt: mtMap.objectField('next_attempt_at', mtMap.date()),
          completedAt: mtMap.objectField('completed_at', mtMap.date()),
          createdAt: mtMap.objectField('created_at', mtMap.date()),
          updatedAt: mtMap.objectField('updated_at', mtMap.date())
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

export type DashboardOrganizationsEventDeliveriesListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & {
  status?:
    | 'pending'
    | 'retrying'
    | 'delivered'
    | 'failed'
    | 'cancelled'
    | ('pending' | 'retrying' | 'delivered' | 'failed' | 'cancelled')[]
    | undefined;
  eventId?: string | string[] | undefined;
  eventType?: string | string[] | undefined;
  eventDestinationId?: string | string[] | undefined;
  instanceId?: string | string[] | undefined;
};

export let mapDashboardOrganizationsEventDeliveriesListQuery = mtMap.union([
  mtMap.unionOption(
    'object',
    mtMap.object({
      limit: mtMap.objectField('limit', mtMap.passthrough()),
      after: mtMap.objectField('after', mtMap.passthrough()),
      before: mtMap.objectField('before', mtMap.passthrough()),
      cursor: mtMap.objectField('cursor', mtMap.passthrough()),
      order: mtMap.objectField('order', mtMap.passthrough()),
      status: mtMap.objectField(
        'status',
        mtMap.union([mtMap.unionOption('array', mtMap.union([]))])
      ),
      eventId: mtMap.objectField(
        'event_id',
        mtMap.union([
          mtMap.unionOption('string', mtMap.passthrough()),
          mtMap.unionOption(
            'array',
            mtMap.union([mtMap.unionOption('string', mtMap.passthrough())])
          )
        ])
      ),
      eventType: mtMap.objectField(
        'event_type',
        mtMap.union([
          mtMap.unionOption('string', mtMap.passthrough()),
          mtMap.unionOption(
            'array',
            mtMap.union([mtMap.unionOption('string', mtMap.passthrough())])
          )
        ])
      ),
      eventDestinationId: mtMap.objectField(
        'event_destination_id',
        mtMap.union([
          mtMap.unionOption('string', mtMap.passthrough()),
          mtMap.unionOption(
            'array',
            mtMap.union([mtMap.unionOption('string', mtMap.passthrough())])
          )
        ])
      ),
      instanceId: mtMap.objectField(
        'instance_id',
        mtMap.union([
          mtMap.unionOption('string', mtMap.passthrough()),
          mtMap.unionOption(
            'array',
            mtMap.union([mtMap.unionOption('string', mtMap.passthrough())])
          )
        ])
      )
    })
  )
]);

