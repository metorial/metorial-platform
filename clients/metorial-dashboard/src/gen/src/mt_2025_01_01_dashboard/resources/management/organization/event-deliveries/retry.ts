import { mapObject } from '@metorial/util-resource-mapper/compact';

export type ManagementOrganizationEventDeliveriesRetryOutput = {
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
};

export let mapManagementOrganizationEventDeliveriesRetryOutput =
  /* @__PURE__ */ mapObject<ManagementOrganizationEventDeliveriesRetryOutput>(
    [
      'organization_id',
      'instance_id',
      'event_id',
      'event_type',
      'event_destination_id',
      'attempt_count',
      [
        'retry',
        0,
        [1, ['max_attempts', 'base_delay_seconds', 'max_delay_seconds']]
      ],
      [
        'attempts',
        0,
        [
          2,
          [
            1,
            [
              'event_delivery_id',
              'event_id',
              'event_destination_id',
              'attempt_number',
              'duration_ms',
              'is_retryable',
              ['response', 0, [1, ['status_code', 'is_body_truncated']]],
              'started_at',
              'completed_at',
              'created_at'
            ]
          ]
        ]
      ],
      'last_attempt_at',
      'next_attempt_at',
      'completed_at',
      'created_at',
      'updated_at'
    ],
    1
  );
