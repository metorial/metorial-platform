import { Presenter } from '@metorial/presenter';
import { v } from '@metorial/validation';
import { callbackDestinationType } from '../types';

export let v1CallbackDestinationPresenter = Presenter.create(callbackDestinationType)
  .presenter(async ({ callbackDestination }, opts) => ({
    object: 'callback.destination',

    id: callbackDestination.id,

    type: {
      webhook_http: 'webhook'
    }[callbackDestination.type],

    name: callbackDestination.name,
    description: callbackDestination.description ?? '',

    webhook_destination: callbackDestination.url
      ? {
          url: callbackDestination.url,
          signing_secret: callbackDestination.signingSecret
        }
      : null,

    callbacks:
      callbackDestination.selectionType == 'all'
        ? {
            type: 'all'
          }
        : {
            type: 'selected',
            callback_ids: callbackDestination.callbacks.map(c => c.callback.id)
          },

    created_at: callbackDestination.createdAt
  }))
  .schema(
    v.object({
      object: v.literal('callback.destination', {
        name: 'object',
        description: 'Type of the object, fixed as callback.destination'
      }),

      id: v.string({
        name: 'id',
        description: 'The unique identifier of the callback destination'
      }),

      type: v.enumOf(['webhook'], {
        name: 'type',
        description: 'The type of the callback destination'
      }),

      name: v.string({
        name: 'name',
        description: 'The name of the callback destination'
      }),

      description: v.string({
        name: 'description',
        description: 'The description of the callback destination'
      }),

      webhook_destination: v.nullable(
        v.object(
          {
            url: v.string({
              name: 'url',
              description: 'The URL of the webhook callback destination'
            }),
            signing_secret: v.string({
              name: 'signing_secret',
              description: 'The signing secret used for securing webhook requests'
            })
          },
          {
            name: 'webhook_destination',
            description: 'Details of the webhook callback destination, if applicable'
          }
        )
      ),

      callbacks: v.union(
        [
          v.object({
            type: v.literal('all', {
              name: 'type',
              description: 'Indicates that all callbacks are selected for this destination'
            })
          }),
          v.object({
            type: v.literal('selected', {
              name: 'type',
              description:
                'Indicates that specific callbacks are selected for this destination'
            }),
            callback_ids: v.array(
              v.string({
                name: 'callback_id',
                description: 'The unique identifier of the selected callback'
              }),
              {
                name: 'callback_ids',
                description: 'List of selected callback IDs for this destination'
              }
            )
          })
        ],
        {
          name: 'callbacks',
          description: 'Information about the callbacks associated with this destination'
        }
      ),

      created_at: v.date({
        name: 'created_at',
        description: 'Timestamp when the callback destination was created'
      })
    })
  )
  .build();
