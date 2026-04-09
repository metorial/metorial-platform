import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { consumerSurfaceType } from '../types';

export let v1ConsumerSurfacePresenter = Presenter.create(consumerSurfaceType)
  .presenter(async ({ consumerSurface }) => ({
    object: 'consumer.surface' as const,
    id: consumerSurface.id,
    status: consumerSurface.status,
    name: consumerSurface.name,
    description: consumerSurface.description,

    auth: {
      object: 'consumer.surface.auth' as const,
      session_expiry_time_in_seconds: consumerSurface.sessionExpiryTimeInSeconds,
      email_whitelist: consumerSurface.emailWhitelist
    },

    created_at: consumerSurface.createdAt,
    updated_at: consumerSurface.updatedAt
  }))
  .schema(
    v.object({
      object: v.literal('consumer.surface'),
      id: v.string(),
      status: v.enumOf(['active', 'archived', 'deleted']),
      name: v.string(),
      description: v.nullable(v.string()),
      auth: v.object({
        object: v.literal('consumer.surface.auth'),
        session_expiry_time_in_seconds: v.number(),
        email_whitelist: v.array(v.string())
      }),
      created_at: v.date(),
      updated_at: v.date()
    })
  )
  .build();
