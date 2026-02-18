import { createSubspaceService } from '../lib/subspaceService';
import { subspace } from '../subspace';

export let subspaceProviderListingCategoryService = createSubspaceService(
  subspace.providerListingCategory,
  ['get', 'list'],
  () => ({})
);

export type SubspaceProviderListingCategory = Awaited<ReturnType<typeof subspace.providerListingCategory.get>>;
