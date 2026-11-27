import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { eventDeliveryAttemptType } from '../../types';

let headerSchema = (description: string) =>
  v.array(
    v.object({
      key: v.string({ description: 'Header name', examples: ['content-type'] }),
      value: v.string({ description: 'Header value', examples: ['application/json'] })
    }),
    { description }
  );

export let v1EventDeliveryAttemptPresenter = Presenter.create(eventDeliveryAttemptType)
  .presenter(async ({ attempt, details }) => ({
    object: 'event.delivery_attempt',
    id: attempt.id,
    event_delivery_id: attempt.intent.id,
    event_id: attempt.intent.systemEvent.id,
    event_destination_id: attempt.intent.eventDestination.id,

    status: attempt.status,
    attempt_number: attempt.attemptNumber,
    duration_ms: attempt.durationMs,
    is_retryable: attempt.isRetryable,

    error: attempt.errorCode
      ? { code: attempt.errorCode, message: attempt.errorMessage ?? attempt.errorCode }
      : null,

    request: details
      ? {
          url: details.request.url,
          method: details.request.method,
          headers: details.request.headers,
          body: details.request.body
        }
      : null,

    response:
      details?.response || attempt.responseStatusCode != null
        ? {
            status_code: details?.response?.statusCode ?? attempt.responseStatusCode!,
            headers: details?.response?.headers ?? null,
            body: details?.response?.body ?? null,
            is_body_truncated: details?.response?.isBodyTruncated ?? false
          }
        : null,

    started_at: attempt.startedAt,
    completed_at: attempt.completedAt,
    created_at: attempt.createdAt
  }))
  .schema(
    v.object({
      object: v.literal('event.delivery_attempt'),
      id: v.string({
        description: 'Unique identifier for the delivery attempt',
        examples: ['evda_1aBcDeFgHjKlMnPq']
      }),
      event_delivery_id: v.string({
        description: 'The delivery this attempt belongs to',
        examples: ['evdi_1aBcDeFgHjKlMnPq']
      }),
      event_id: v.string({
        description: 'The event that was being delivered',
        examples: ['evnt_1aBcDeFgHjKlMnPq']
      }),
      event_destination_id: v.string({
        description: 'The event destination this attempt targeted',
        examples: ['evtd_1aBcDeFgHjKlMnPq']
      }),
      status: v.enumOf(['succeeded', 'failed'], {
        description: 'Whether the destination accepted this attempt'
      }),
      attempt_number: v.number({
        description: 'Position of this attempt within the delivery, starting at 1',
        examples: [1]
      }),
      duration_ms: v.number({
        description: 'How long the attempt took, in milliseconds',
        examples: [143]
      }),
      is_retryable: v.boolean({
        description:
          'Whether the failure was classed as transient. A non-retryable failure ends the delivery immediately instead of consuming the remaining attempts.'
      }),
      error: v.nullable(
        v.object(
          {
            code: v.string({
              description: 'Machine-readable failure code',
              examples: ['http_503', 'timeout', 'request_failed', 'url_not_allowed']
            }),
            message: v.string({
              description: 'Human-readable description of the failure',
              examples: ['Destination responded with HTTP 503']
            })
          },
          { description: 'Why the attempt failed. `null` for a successful attempt.' }
        )
      ),
      request: v.nullable(
        v.object(
          {
            url: v.string({
              description: 'URL the attempt was sent to',
              examples: ['https://example.com/webhooks/metorial']
            }),
            method: v.string({ description: 'HTTP method used', examples: ['POST'] }),
            headers: headerSchema('Headers sent with the request'),
            body: v.nullable(v.string({ description: 'Request body sent to the destination' }))
          },
          {
            description:
              'What Metorial sent. Only returned when reading a single attempt — list responses omit it.'
          }
        )
      ),
      response: v.nullable(
        v.object(
          {
            status_code: v.number({
              description: 'HTTP status code returned by the destination',
              examples: [200]
            }),
            headers: v.nullable(headerSchema('Headers returned by the destination')),
            body: v.nullable(
              v.string({
                description:
                  'Response body returned by the destination, truncated to 16KB. Only returned when reading a single attempt.'
              })
            ),
            is_body_truncated: v.boolean({
              description: 'Whether the stored response body was cut off at the size limit'
            })
          },
          {
            description:
              'What the destination returned. `null` when the attempt never produced a response, for example on a timeout.'
          }
        )
      ),
      started_at: v.date({ description: 'When the attempt was sent' }),
      completed_at: v.date({ description: 'When the attempt finished' }),
      created_at: v.date({ description: 'When the attempt was recorded' })
    })
  )
  .build();
