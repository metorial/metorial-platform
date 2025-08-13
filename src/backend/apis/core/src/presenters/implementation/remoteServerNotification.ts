import { Presenter } from '@metorial/presenter';
import { v } from '@metorial/validation';
import { remoteServerNotificationType } from '../types';

export let v1RemoteServerNotificationPresenter = Presenter.create(remoteServerNotificationType)
  .presenter(async ({ remoteServerInstanceNotification }, opts) => ({
    object: 'custom_server.remote_server.notification',

    id: remoteServerInstanceNotification.id,

    type: {
      connection_issue: 'connection_issue' as const
    }[remoteServerInstanceNotification.type],
    message: remoteServerInstanceNotification.message,
    payload: remoteServerInstanceNotification.payload,

    remote_server_id: remoteServerInstanceNotification.remoteServerInstance.id,

    created_at: remoteServerInstanceNotification.createdAt
  }))
  .schema(
    v.object({
      object: v.literal('custom_server.remote_server.notification'),

      id: v.string({ name: 'id', description: `The remote server's unique identifier` }),

      type: v.enumOf(['connection_issue'], {
        name: 'type',
        description: `The type of notification`
      }),

      message: v.string({
        name: 'message',
        description: `A human-readable message describing the notification`
      }),
      payload: v.nullable(
        v.record(v.any(), {
          name: 'payload',
          description: `Additional data related to the notification`
        })
      ),

      remote_server_id: v.string({
        name: 'remote_server_id',
        description: `The ID of the associated remote server instance`
      }),

      created_at: v.date({
        name: 'created_at',
        description: `The remote server's creation date`
      })
    })
  )
  .build();
