import { Presenter } from '@metorial/presenter';
import { shadowId } from '@metorial/shadow-id';
import { v } from '@metorial/validation';
import { callbackNotificationType } from '../types';

export let v1CallbackNotificationPresenter = Presenter.create(callbackNotificationType)
  .presenter(async ({ callbackNotification }, opts) => ({
    object: 'callback.notification',

    id: callbackNotification.id,

    type: callbackNotification.type,
    status: callbackNotification.status,

    url: callbackNotification.url,

    attempts: callbackNotification.attempts
      .sort((a, b) => a.attemptIndex - b.attemptIndex)
      .map(attempt => ({
        object: 'callback.notification.attempt',

        id: attempt.id,
        status: attempt.status,

        index: attempt.attemptIndex,

        webhook_request: callbackNotification.url
          ? {
              object: 'callback.notification.attempt.webhook_request',

              id: shadowId('cnawh', [callbackNotification.id, attempt.id]),

              url: callbackNotification.url!,
              request_method: 'POST',
              request_body: callbackNotification.requestBody!,
              request_headers: Object.fromEntries(callbackNotification.requestHeaders!),

              response_status: attempt.responseStatusCode!,
              response_body: attempt.responseBody!,
              response_headers: Object.fromEntries(attempt.responseHeaders!),

              request_error: attempt.requestError,

              duration: attempt.durationMs!,
              created_at: attempt.createdAt
            }
          : null,

        created_at: attempt.createdAt
      })),

    created_at: callbackNotification.createdAt
  }))
  .schema(
    v.object({
      object: v.literal('callback.notification', {
        name: 'object',
        description: 'Type of the object, fixed as callback.notification'
      }),

      id: v.string({
        name: 'id',
        description: 'The unique identifier of the callback notification'
      }),

      type: v.enumOf(['webhook_http'], {
        name: 'type',
        description: 'The type of the callback notification'
      }),

      status: v.enumOf(['pending', 'succeeded', 'retrying', 'failed'], {
        name: 'status',
        description: 'The status of the callback notification'
      }),

      url: v.nullable(
        v.string({
          name: 'url',
          description: 'The URL to which the callback notification was sent'
        })
      ),

      attempts: v.array(
        v.object({
          object: v.literal('callback.notification.attempt', {
            name: 'object',
            description: 'Type of the object, fixed as callback.notification.attempt'
          }),

          id: v.string({
            name: 'id',
            description: 'The unique identifier of the callback notification attempt'
          }),

          status: v.enumOf(['succeeded', 'failed'], {
            name: 'status',
            description: 'The status of the callback notification attempt'
          }),

          index: v.number({
            name: 'index',
            description: 'The index of the attempt'
          }),

          webhook_request: v.nullable(
            v.object({
              object: v.literal('callback.notification.attempt.webhook_request', {
                name: 'object',
                description:
                  'Type of the object, fixed as callback.notification.attempt.webhook_request'
              }),

              id: v.string({
                name: 'id',
                description: 'The unique identifier of the webhook request'
              }),

              url: v.string({
                name: 'url',
                description: 'The URL to which the webhook request was sent'
              }),

              request_method: v.literal('POST', {
                name: 'request_method',
                description: 'The HTTP method used for the webhook request'
              }),

              request_body: v.string({
                name: 'request_body',
                description: 'The body of the webhook request'
              }),

              request_headers: v.record(
                v.string({
                  name: 'header_value',
                  description: 'The value of the header'
                }),
                {
                  name: 'request_headers',
                  description: 'The headers of the webhook request'
                }
              ),

              response_status: v.number({
                name: 'response_status',
                description: 'The HTTP status code of the webhook response'
              }),

              response_body: v.string({
                name: 'response_body',
                description: 'The body of the webhook response'
              }),

              response_headers: v.record(
                v.string({
                  name: 'header_value',
                  description: 'The value of the header'
                }),
                {
                  name: 'response_headers',
                  description: 'The headers of the webhook response'
                }
              ),

              request_error: v.nullable(
                v.string({
                  name: 'request_error',
                  description: 'The error message if the webhook request failed'
                })
              ),

              duration: v.number({
                name: 'duration',
                description: 'The duration of the webhook request in milliseconds'
              }),

              created_at: v.date({
                name: 'created_at',
                description: 'Timestamp when the webhook request was created'
              })
            })
          ),

          created_at: v.date({
            name: 'created_at',
            description: 'Timestamp when the callback notification attempt was created'
          })
        }),
        {
          name: 'attempts',
          description: 'List of attempts for the callback notification'
        }
      ),

      created_at: v.date({
        name: 'created_at',
        description: 'Timestamp when the callback notification was created'
      })
    })
  )
  .build();
