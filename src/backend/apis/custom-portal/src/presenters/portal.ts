import { ConsumerSurface, getImageUrl, Portal } from '@metorial/db';

export let portalPresenter = async (portal: Portal & { surface: ConsumerSurface }) => ({
  object: 'portal#portal',

  id: portal.id,

  name: portal.name,
  slug: portal.slug,

  brand: {
    object: 'portal#portal.brand',

    name: portal.brandName,
    image: await getImageUrl({
      ...portal,
      image: portal.brandImage
    })
  },

  surface: {
    object: 'portal#consumer.surface',

    id: portal.surface.id,
    sessionExpiryTimeInSeconds: portal.surface.sessionExpiryTimeInSeconds,

    createdAt: portal.surface.createdAt,
    updatedAt: portal.surface.updatedAt
  },

  createdAt: portal.createdAt,
  updatedAt: portal.updatedAt
});
