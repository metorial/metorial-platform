import { createMapper } from '@metorial/util-resource-mapper/compact';

export type ManagementOrganizationEventDeliveryAttemptsListOutput = {
  items: {
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
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapManagementOrganizationEventDeliveryAttemptsListOutput =
  /* @__PURE__ */ createMapper<ManagementOrganizationEventDeliveryAttemptsListOutput>(
    [
      7,
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
    ],
    1
  );

export type ManagementOrganizationEventDeliveryAttemptsListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & {
  status?: 'succeeded' | 'failed' | ('succeeded' | 'failed')[] | undefined;
  eventDeliveryId?: string | string[] | undefined;
  eventId?: string | string[] | undefined;
  eventDestinationId?: string | string[] | undefined;
};

export let mapManagementOrganizationEventDeliveryAttemptsListQuery =
  /* @__PURE__ */ createMapper<ManagementOrganizationEventDeliveryAttemptsListQuery>(
    [3, [[0, [1, ['event_delivery_id', 'event_id', 'event_destination_id']]]]]
  );
