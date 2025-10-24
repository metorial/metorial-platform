import { Presenter } from '@metorial/presenter';
import { v } from '@metorial/validation';
import { callbackType } from '../types';

export let v1CallbackPresenter = Presenter.create(callbackType)
  .presenter(async ({ callback }, opts) => ({
    object: 'callback',

    id: callback.id,
    type: {
      webhook: 'webhook_managed',
      polling: 'polling',
      manual: 'webhook_manual'
    }[callback.eventType],

    name: callback.name,
    description: callback.description,

    url:
      callback.eventType == 'manual'
        ? `${process.env.CALLBACKS_URL}/callbacks/hook/${callback.hooks[0].key}`
        : null,

    schedule: {
      object: 'callback.schedule',

      interval_seconds: callback.intervalSeconds,
      next_run_at: callback.schedule?.nextRunAt ?? null
    },

    created_at: callback.createdAt,
    updated_at: callback.updatedAt
  }))
  .schema(
    v.object({
      object: v.literal('callback', {
        name: 'object',
        description: 'Type of the object, fixed as callback'
      }),

      id: v.string({
        name: 'id',
        description: 'The unique identifier of the callback'
      }),

      url: v.nullable(
        v.string({
          name: 'url',
          description:
            'The URL to which the callback will send data (only for manual webhook type)'
        })
      ),

      name: v.nullable(
        v.string({
          name: 'name',
          description: 'The name of the callback'
        })
      ),

      description: v.nullable(
        v.string({
          name: 'description',
          description: 'The description of the callback'
        })
      ),

      type: v.enumOf(['webhook_managed', 'polling', 'webhook_manual'], {
        name: 'type',
        description: 'The type of the callback'
      }),

      schedule: v.object({
        object: v.literal('callback.schedule', {
          name: 'object',
          description: 'Type of the object, fixed as callback.schedule'
        }),

        interval_seconds: v.number({
          name: 'interval_seconds',
          description: 'The interval in seconds for polling callbacks'
        }),
        next_run_at: v.date({
          name: 'next_run_at',
          description: 'The next scheduled run time for the callback'
        })
      }),

      created_at: v.date({
        name: 'created_at',
        description: 'Timestamp when the callback was created'
      }),
      updated_at: v.date({
        name: 'updated_at',
        description: 'Timestamp when the callback was last updated'
      })
    })
  )
  .build();
