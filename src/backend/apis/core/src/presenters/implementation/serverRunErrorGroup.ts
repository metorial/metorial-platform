import { Presenter } from '@metorial/presenter';
import { v } from '@metorial/validation';
import { serverRunErrorGroupType } from '../types';
import { v1ServerRunErrorPresenter } from './serverRunError';

export let v1ServerRunErrorGroupPresenter = Presenter.create(serverRunErrorGroupType)
  .presenter(async ({ serverRunErrorGroup }, opts) => ({
    object: 'server.server_run.error_group',

    id: serverRunErrorGroup.id,
    code: serverRunErrorGroup.code,
    message: serverRunErrorGroup.message,

    fingerprint: serverRunErrorGroup.fingerprint,

    default_error: serverRunErrorGroup.defaultServerRunError
      ? await v1ServerRunErrorPresenter
          .present({ serverRunError: serverRunErrorGroup.defaultServerRunError }, opts)
          .run()
      : null,

    count: serverRunErrorGroup.count,

    created_at: serverRunErrorGroup.createdAt,
    first_seen_at: serverRunErrorGroup.createdAt,
    last_seen_at: serverRunErrorGroup.lastSeenAt
  }))
  .schema(
    v.object({
      object: v.literal('server.server_run.error'),

      id: v.string({
        name: 'id',
        description: 'The unique identifier of the server run error instance'
      }),

      code: v.string({
        name: 'code',
        description: 'A machine-readable error code'
      }),

      message: v.string({
        name: 'message',
        description: 'A human-readable description of the error'
      }),

      fingerprint: v.string({
        name: 'fingerprint',
        description: 'A unique fingerprint representing this error for grouping similar errors'
      }),

      count: v.number({
        name: 'count',
        description: 'The number of times this error has occurred'
      }),

      default_error: v.nullable(v1ServerRunErrorPresenter.schema),

      created_at: v.date({
        name: 'created_at',
        description: 'Timestamp when this error record was created'
      }),

      first_seen_at: v.date({
        name: 'first_seen_at',
        description: 'Timestamp when this error was first observed'
      }),

      last_seen_at: v.date({
        name: 'last_seen_at',
        description: 'Timestamp when this error was last observed'
      })
    })
  )
  .build();
