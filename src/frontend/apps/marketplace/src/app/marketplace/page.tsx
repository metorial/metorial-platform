'use server';

import { listServerCategories, listServers } from '../../state/server';
import { LandingAbout } from './components/about';
import { CollectionCarousel } from './components/carousel';
import { LandingHeader } from './components/header';
import { Categories } from './components/servers/categories';
import { ServerList } from './components/servers/list';

export default async () => {
  let [categories, servers] = await Promise.all([
    listServerCategories({}),
    listServers({
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
        <ServerList servers={servers.items} />
      </Categories>

      <LandingAbout />
    </>
  );
};
