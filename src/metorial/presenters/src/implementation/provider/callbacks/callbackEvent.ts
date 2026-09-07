import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { callbackEventType } from '../../../types';

export let v1CallbackEventPresenter = Presenter.create(callbackEventType)
  .presenter(async ({ callbackEvent, details }) => ({
    object: 'callback_event' as const,

    id: callbackEvent.id,
    status: callbackEvent.status,
    source: callbackEvent.source,

    provider_trigger_key: callbackEvent.providerTriggerKey,
    mapped_type: callbackEvent.mappedType,
    mapped_id: callbackEvent.mappedId,

    callback_id: callbackEvent.callback.id,
    callback_instance_id: callbackEvent.callbackInstance.id,

    details: details
      ? {
          object: 'callback_event.details' as const,

          status: details.status,
          payload: details.payload,
          attempt_count: details.attemptCount,

          error: details.error
            ? {
                object: 'callback_event.details.error' as const,
                code: details.error.code,
                message: details.error.message
              }
            : null,

          webhook: details.webhook
            ? {
                object: 'callback_event.details.webhook' as const,

                status: details.webhook.status,
                attempt_count: details.webhook.attemptCount,

                request: details.webhook.request
                  ? {
                      object: 'callback_event.details.webhook.request' as const,
                      method: details.webhook.request.method,
                      url: details.webhook.request.url,
                      headers: details.webhook.request.headers,
                      body: details.webhook.request.body
                    }
                  : null,

                received_at: details.webhook.receivedAt
              }
            : null
        }
      : null,

    occurred_at: callbackEvent.occurredAt,
    created_at: callbackEvent.createdAt
  }))
  .schema(
    v.object({
      object: v.literal('callback_event', {
        description: "String representing the object's type"
      }),

      id: v.string({
        name: 'id',
        description: 'Unique callback event identifier',
        examples: ['cbe_8kLmNpQrStUvWxYz']
      }),

      status: v.enumOf(['pending', 'processed', 'failed'], {
        name: 'status',
        description: 'Processing status of this callback event within Metorial'
      }),

      source: v.enumOf(['webhook', 'polling'], {
        name: 'source',
        description: 'How the provider trigger that produced this event was invoked'
      }),

      provider_trigger_key: v.string({
        name: 'provider_trigger_key',
        description: 'Key of the provider trigger this event was produced by',
        examples: ['repository.pushed']
      }),

      mapped_type: v.nullable(
        v.string({
          name: 'mapped_type',
          description: 'Type of the resource the provider mapped this event to, if any',
          examples: ['pull_request']
        })
      ),

      mapped_id: v.nullable(
        v.string({
          name: 'mapped_id',
          description: 'Identifier of the resource the provider mapped this event to, if any',
          examples: ['42']
        })
      ),

      callback_id: v.string({
        name: 'callback_id',
        description: 'Callback this event was recorded for',
        examples: ['cbk_4dEfGhJkLmNpQrSt']
      }),

      callback_instance_id: v.string({
        name: 'callback_instance_id',
        description: 'Callback instance this event was recorded for',
        examples: ['cbi_5gHjKlMnPqRsTuVw']
      }),

      details: v.nullable(
        v.object(
          {
            object: v.literal('callback_event.details', {
              description: "String representing the object's type"
            }),

            status: v.string({
              name: 'status',
              description:
                'Processing status of the trigger invocation, as reported by the provider backend',
              examples: ['succeeded']
            }),

            payload: v.nullable(
              v.record(v.any(), {
                name: 'payload',
                description: 'Mapped payload the provider trigger produced for this event',
                examples: [{ action: 'opened' }]
              })
            ),

            attempt_count: v.number({
              name: 'attempt_count',
              description: 'Number of processing attempts made for this event',
              examples: [1]
            }),

            error: v.nullable(
              v.object(
                {
                  object: v.literal('callback_event.details.error', {
                    description: "String representing the object's type"
                  }),

                  code: v.string({
                    name: 'code',
                    description: 'Machine-readable reason this event failed to process',
                    examples: ['mapping_failed']
                  }),

                  message: v.string({
                    name: 'message',
                    description: 'Human-readable reason this event failed to process',
                    examples: ['Failed to map the trigger payload.']
                  })
                },
                {
                  name: 'error',
                  description: 'The processing failure, if this event failed'
                }
              )
            ),

            webhook: v.nullable(
              v.object(
                {
                  object: v.literal('callback_event.details.webhook', {
                    description: "String representing the object's type"
                  }),

                  status: v.string({
                    name: 'status',
                    description:
                      'Processing status of the inbound webhook, as reported by the provider backend',
                    examples: ['succeeded']
                  }),

                  attempt_count: v.number({
                    name: 'attempt_count',
                    description: 'Number of processing attempts made for the inbound webhook',
                    examples: [1]
                  }),

                  request: v.nullable(
                    v.object(
                      {
                        object: v.literal('callback_event.details.webhook.request', {
                          description: "String representing the object's type"
                        }),

                        method: v.string({
                          name: 'method',
                          description: 'HTTP method of the inbound request',
                          examples: ['POST']
                        }),

                        url: v.string({
                          name: 'url',
                          description: 'URL the inbound request was sent to',
                          examples: ['https://callbacks.metorial.com/w/whk_7dEfGhJkLmNpQrSt']
                        }),

                        headers: v.record(v.string(), {
                          name: 'headers',
                          description: 'Headers of the inbound request',
                          examples: [{ 'content-type': 'application/json' }]
                        }),

                        body: v.nullable(
                          v.object(
                            {
                              encoding: v.literal('base64', {
                                description: 'Encoding used for the request body'
                              }),
                              content: v.string({
                                name: 'content',
                                description: 'Base64-encoded request body',
                                examples: ['eyJhY3Rpb24iOiJvcGVuZWQifQ==']
                              })
                            },
                            {
                              name: 'body',
                              description: 'Raw body of the inbound request'
                            }
                          )
                        )
                      },
                      {
                        name: 'request',
                        description:
                          'The inbound HTTP request as it was received. Null once the backend has aged the raw request out of hot storage.'
                      }
                    )
                  ),

                  received_at: v.date({
                    name: 'received_at',
                    description: 'Timestamp when the webhook was received',
                    examples: [new Date('2026-01-10T14:45:00Z')]
                  })
                },
                {
                  name: 'webhook',
                  description: 'The inbound webhook delivery behind this event, if there was one'
                }
              )
            )
          },
          {
            name: 'details',
            description:
              'Enrichment fetched from the provider backend. Only present when fetching a single callback event.'
          }
        )
      ),

      occurred_at: v.date({
        name: 'occurred_at',
        description: 'Timestamp when the underlying provider event occurred',
        examples: [new Date('2026-01-10T14:45:00Z')]
      }),

      created_at: v.date({
        name: 'created_at',
        description: 'Timestamp when the callback event was recorded',
        examples: [new Date('2026-01-10T14:45:00Z')]
      })
    })
  )
  .build();
