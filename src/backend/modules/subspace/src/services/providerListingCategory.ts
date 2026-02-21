import { createSubspacePublicService, createSubspaceService } from '../lib/subspaceService';
import { subspace } from '../subspace';

export let subspaceProviderListingCategoryService = createSubspaceService(
  subspace.providerListingCategory,
  ['get', 'list'],
  () => ({})
);

export let subspacePublicProviderListingCategoryService = createSubspacePublicService(
  subspace.providerListingCategory,
  ['get', 'list'],
  () => ({})
);

export type SubspaceProviderListingCategory = Awaited<
  ReturnType<typeof subspace.providerListingCategory.get>
>;
export type SubspaceProviderListingCategoryList = Awaited<
  ReturnType<typeof subspace.providerListingCategory.list>
>;
export type SubspaceProviderListingCategoryListItem =
  SubspaceProviderListingCategoryList['items'][number];
