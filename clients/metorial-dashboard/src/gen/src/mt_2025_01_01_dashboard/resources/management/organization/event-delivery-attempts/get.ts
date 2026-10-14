import { mapObject } from '@metorial/util-resource-mapper/compact';

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
  /* @__PURE__ */ mapObject<ManagementOrganizationEventDeliveryAttemptsGetOutput>(
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
    ],
    1
  );
