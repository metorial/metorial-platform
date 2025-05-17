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

      id: v.string(),

      code: v.string(),
      message: v.string(),
      metadata: v.record(v.any()),

      server_run: v1ServerRunPresenter.schema,

      created_at: v.date()
    })
  )
  .build();
