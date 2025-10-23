import { Presenter } from '@metorial/presenter';
import { v } from '@metorial/validation';
import { callbackEventType } from '../types';

export let v1CallbackEventPresenter = Presenter.create(callbackEventType)
  .presenter(async ({ callbackEvent }, opts) => ({
    object: 'callback.event',

    id: callbackEvent.id,

    status: callbackEvent.status,
    type: callbackEvent.eventType,

    payload_incoming: callbackEvent.payloadIncoming,
    payload_outgoing: callbackEvent.payloadOutgoing,

    processing_attempts: callbackEvent.processingAttempts
      .sort((a, b) => a.attemptIndex - b.attemptIndex)
      .map(attempt => ({
        object: 'callback.event.attempt',

        id: attempt.id,
        status: attempt.status,

        index: attempt.attemptIndex,

        error_code: attempt.errorCode,
        error_message: attempt.errorMessage,

        created_at: attempt.createdAt
      })),

    created_at: callbackEvent.createdAt
  }))
  .schema(
    v.object({
      object: v.literal('callback.event', {
        name: 'object',
        description: 'Type of the object, fixed as callback.event'
      }),

      id: v.string({
        name: 'id',
        description: 'The unique identifier of the callback event'
      }),

      type: v.nullable(
        v.string({
          name: 'type',
          description: 'The type of the callback event'
        })
      ),

      status: v.enumOf(['pending', 'succeeded', 'retrying', 'failed'], {
        name: 'status',
        description: 'The status of the callback event'
      }),

      payload_incoming: v.string({
        name: 'payload_incoming',
        description: 'The incoming payload of the callback event'
      }),

      payload_outgoing: v.nullable(
        v.string({
          name: 'payload_outgoing',
          description: 'The outgoing payload of the callback event'
        })
      ),

      processing_attempts: v.array(
        v.object({
          object: v.literal('callback.event.attempt', {
            name: 'object',
            description: 'Type of the object, fixed as callback.event.attempt'
          }),

          id: v.string({
            name: 'id',
            description: 'The unique identifier of the callback event attempt'
          }),

          status: v.enumOf(['succeeded', 'failed'], {
            name: 'status',
            description: 'The status of the callback event attempt'
          }),

          index: v.number({
            name: 'index',
            description: 'The index of the callback event attempt'
          }),

          error_code: v.nullable(
            v.string({
              name: 'error_code',
              description: 'The error code if the callback event attempt failed'
            })
          ),

          error_message: v.nullable(
            v.string({
              name: 'error_message',
              description: 'The error message if the callback event attempt failed'
            })
          ),

          created_at: v.date({
            name: 'created_at',
            description: 'Timestamp when the callback event attempt was created'
          })
        }),
        {
          name: 'attempts',
          description: 'List of processing attempts for the callback event'
        }
      ),

      created_at: v.date({
        name: 'created_at',
        description: 'Timestamp when the callback event was created'
      })
    })
  )
  .build();
