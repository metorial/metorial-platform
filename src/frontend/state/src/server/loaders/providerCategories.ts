import { createLoader } from '@metorial/data-hooks';
import { useCurrentInstance } from '../../organization';
import { withAuth } from '../../user';

export let providerCategoriesLoader = createLoader({
  name: 'providerCategories',
  parents: [],
  fetch: (i: { instanceId: string }) =>
    withAuth(sdk => sdk.providers.categories.list(i.instanceId)),
  mutators: {}
});

export let useProviderCategories = () => {
  let instance = useCurrentInstance();
  let data = providerCategoriesLoader.use(
    instance.data?.instanceId ? { instanceId: instance.data.instanceId } : null
  );
  return data;
};
