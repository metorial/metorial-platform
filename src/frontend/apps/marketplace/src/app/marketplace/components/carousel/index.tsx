'use server';

import { getServerCategory, getServerCollection, listServers } from '../../../../state/server';
import { ServerCarouselWithGroup } from './carousel';

export let CollectionCarousel = async ({ collectionId }: { collectionId: string }) => {
  let [collection, servers] = await Promise.all([
    getServerCollection(collectionId),
    listServers({ collectionIds: [collectionId], limit: '15' })
  ]);

  return <ServerCarouselWithGroup group={collection} servers={servers.items} />;
};

export let CategoryCarousel = async ({ categoryId }: { categoryId: string }) => {
  let [category, servers] = await Promise.all([
    getServerCategory(categoryId),
    listServers({ categoryIds: [categoryId], limit: '15' })
  ]);

  return <ServerCarouselWithGroup group={category} servers={servers.items} />;
};
