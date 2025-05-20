'use server';

import { listServerCategories, listServers } from '../../../state/server';
import { LandingHeader } from '../components/header';
import { Categories } from '../components/servers/categories';
import { ServerList } from '../components/servers/list';

export default async ({
  searchParams
}: {
  searchParams: Promise<{
    search?: string;
    after?: string;
    before?: string;
    collection_ids?: string;
    category_ids?: string;
    profile_ids?: string;
  }>;
}) => {
  let { search, after, before, category_ids, collection_ids, profile_ids } =
    await searchParams;

  let categoryIds = category_ids?.split(',').filter(Boolean);
  let collectionIds = collection_ids?.split(',').filter(Boolean);
  let profileIds = profile_ids?.split(',').filter(Boolean);

  let [servers, categories] = await Promise.all([
    listServers({
      search,
      after,
      before,
      limit: '25',

      categoryIds,
      collectionIds,
      profileIds
    }),
    listServerCategories({ limit: '100' })
  ]);

  return (
    <>
      <LandingHeader search={search} />

      <Categories categories={categories.items} currentCategoryIds={categoryIds}>
        <ServerList servers={servers.items} />
      </Categories>
    </>
  );
};
