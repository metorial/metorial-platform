'use server';

import { listServerCategories, listServers } from '../../state/server';
import { LandingAbout } from './components/about';
import { CategoryCarousel } from './components/carousel';
// import { LandingCategories } from './components/categories/single';
import { LandingHeader } from './components/header';
import { Categories } from './components/servers/categories';
import { ServerList } from './components/servers/list';

export default async () => {
  // let featuredCategories = await getAllFeaturedServers();

  let [categories, servers] = await Promise.all([
    listServerCategories({ limit: '100' }),
    listServers({
      collectionIds: process.env.LANDING_COLLECTION_IDS?.split(',')
    })
  ]);

  return (
    <>
      <LandingHeader />

      {process.env.FEATURED_CATEGORY_IDS &&
        process.env.FEATURED_CATEGORY_IDS.split(',').map(categoryId => (
          <CategoryCarousel key={categoryId} categoryId={categoryId} />
        ))}

      <CategoryCarousel categoryId="security" />

      <Categories categories={categories.items}>
        <ServerList servers={servers.items} />
      </Categories>

      <LandingAbout />
    </>
  );
};
