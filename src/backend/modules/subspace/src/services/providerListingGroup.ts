import { createSubspaceService } from '../lib/subspaceService';
import { subspace } from '../subspace';

export let subspaceProviderListingGroupService = createSubspaceService(
  subspace.providerListingGroup,
  ['get', 'list', 'create', 'update', 'addProvider', 'removeProvider'],
  () => ({})
);

export type SubspaceProviderListingGroup = Awaited<
  ReturnType<typeof subspace.providerListingGroup.get>
>;
