import { createLoader } from '@metorial/data-hooks';
import { withAuth } from '../../user';

export let providerCategoriesLoader = createLoader({
  name: 'providerCategories',
  parents: [],
  fetch: (i: { instanceId: string }) =>
    withAuth(sdk => sdk.providers.categories.list(i.instanceId)),
  mutators: {}
});

export let useProviderCategories = (instanceId: string | null | undefined) => {
  let data = providerCategoriesLoader.use(instanceId ? { instanceId } : null);

  return data;
};
