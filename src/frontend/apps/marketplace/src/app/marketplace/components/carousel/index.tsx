'use server';

import { getProviderCategory, getProviderCollection, listProviders } from '../../../../state/provider';
import { ServerCarouselWithGroup } from './carousel';

export let CollectionCarousel = async ({ collectionId }: { collectionId: string }) => {
  let [collection, providerListings] = await Promise.all([
    getProviderCollection(collectionId),
    listProviders({ collectionIds: [collectionId], limit: '15' })
  ]);

  return <ServerCarouselWithGroup group={collection} providerListings={providerListings.items} />;
};

export let CategoryCarousel = async ({ categoryId }: { categoryId: string }) => {
  let [category, providerListings] = await Promise.all([
    getProviderCategory(categoryId),
    listProviders({ categoryIds: [categoryId], limit: '15' })
  ]);

  return <ServerCarouselWithGroup group={category} providerListings={providerListings.items} />;
};
