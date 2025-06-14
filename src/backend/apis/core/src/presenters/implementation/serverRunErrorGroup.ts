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

      id: v.string(),

      code: v.string(),
      message: v.string(),

      fingerprint: v.string(),

      count: v.number(),

      default_error: v.nullable(v1ServerRunErrorPresenter.schema),

      created_at: v.date(),
      first_seen_at: v.date(),
      last_seen_at: v.date()
    })
  )
  .build();
