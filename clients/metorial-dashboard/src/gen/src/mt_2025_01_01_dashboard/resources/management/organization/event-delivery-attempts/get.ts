import { mtMap } from '@metorial/util-resource-mapper';

export type ManagementOrganizationEventDeliveryAttemptsGetOutput = {
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
};

export let mapManagementOrganizationEventDeliveryAttemptsGetOutput =
  mtMap.object<ManagementOrganizationEventDeliveryAttemptsGetOutput>({
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
    attemptNumber: mtMap.objectField('attempt_number', mtMap.passthrough()),
    durationMs: mtMap.objectField('duration_ms', mtMap.passthrough()),
    isRetryable: mtMap.objectField('is_retryable', mtMap.passthrough()),
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
        statusCode: mtMap.objectField('status_code', mtMap.passthrough()),
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
  });

