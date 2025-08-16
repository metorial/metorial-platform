import { Presenter } from '@metorial/presenter';
import { v } from '@metorial/validation';
import { customServerEventType } from '../types';

export let v1CustomServerEventPresenter = Presenter.create(customServerEventType)
  .presenter(async ({ customServerEvent }, opts) => ({
    object: 'custom_server.event',

    id: customServerEvent.id,

    type: {
      remote_connection_issue: 'remote_connection_issue'
    }[customServerEvent.type],

    message: customServerEvent.message,
    payload: customServerEvent.payload,

    custom_server_id: customServerEvent.customServer.id,
    custom_server_version_id: customServerEvent.customServerVersion?.id ?? null,

    created_at: customServerEvent.createdAt
  }))
  .schema(
    v.object({
      object: v.literal('custom_server.event'),

      id: v.string({
        name: 'id',
        description: `The custom server event's unique identifier`
      }),

      type: v.enumOf(['remote_connection_issue'], {
        name: 'type',
        description: `The type of the custom server event`
      }),

      message: v.string({
        name: 'message',
        description: `A message describing the custom server event`
      }),

      payload: v.record(v.any(), {
        name: 'payload',
        description: `Additional data related to the custom server event`
      }),

      custom_server_id: v.string({
        name: 'custom_server_id',
        description: `The ID of the custom server associated with this event`
      }),

      custom_server_version_id: v.nullable(
        v.string({
          name: 'custom_server_version_id',
          description: `The ID of the custom server version associated with this event, if applicable`
        })
      ),

      created_at: v.date({
        name: 'created_at',
        description: `The timestamp when the custom server event was created`
      })
    })
  )
  .build();
