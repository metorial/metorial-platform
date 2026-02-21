'use server';

import { listProviderCategories, listProviders } from '../../state/provider';
import { LandingAbout } from './components/about';
import { CollectionCarousel } from './components/carousel';
import { LandingHeader } from './components/header';
import { Categories } from './components/servers/categories';
import { ProviderList } from './components/servers/list';

export default async () => {
  let [categories, providerListings] = await Promise.all([
    listProviderCategories({}),
    listProviders({
      collectionIds: process.env.LANDING_COLLECTION_IDS?.split(',')
    })
  ]);

  return (
    <>
      <LandingHeader />

      {process.env.FEATURED_COLLECTION_IDS &&
        process.env.FEATURED_COLLECTION_IDS.split(',').map(collectionId => (
          <CollectionCarousel key={collectionId} collectionId={collectionId} />
        ))}

      <Categories categories={categories.items}>
        <ProviderList providerListings={providerListings.items} />
      </Categories>

      <LandingAbout />
    </>
  );
};
