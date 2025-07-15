import { Presenter } from '@metorial/presenter';
import { v } from '@metorial/validation';
import { serverRunErrorType } from '../types';
import { v1ServerRunPresenter } from './serverRun';

export let v1ServerRunErrorPresenter = Presenter.create(serverRunErrorType)
  .presenter(async ({ serverRunError }, opts) => ({
    object: 'server.server_run.error',

    id: serverRunError.id,
    code: serverRunError.code,
    message: serverRunError.message,

    metadata: serverRunError.metadata ?? {},

    server_run: await v1ServerRunPresenter
      .present({ serverRun: serverRunError.serverRun }, opts)
      .run(),

    created_at: serverRunError.createdAt
  }))
  .schema(
    v.object({
      object: v.literal('server.server_run.error'),

      id: v.string({
        name: 'id',
        description: 'The unique identifier of the server run error'
      }),

      code: v.string({
        name: 'code',
        description: 'A machine-readable error code'
      }),

      message: v.string({
        name: 'message',
        description: 'A human-readable description of the error'
      }),

      metadata: v.record(v.any(), {
        name: 'metadata',
        description: 'Additional metadata related to the error'
      }),

      server_run: v1ServerRunPresenter.schema,

      created_at: v.date({
        name: 'created_at',
        description: 'Timestamp when the error was created'
      })
    })
  )
  .build();
