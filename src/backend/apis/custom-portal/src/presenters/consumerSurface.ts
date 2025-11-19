import { ConsumerSurface } from '@metorial/db';

export let consumerSurfacePresenter = async (surface: ConsumerSurface) => ({
  object: 'portal#consumer.surface',

  id: surface.id,
  sessionExpiryTimeInSeconds: surface.sessionExpiryTimeInSeconds,

  createdAt: surface.createdAt,
  updatedAt: surface.updatedAt
});
