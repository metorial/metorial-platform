import { createSubspaceService } from '../lib/subspaceService';
import { subspace } from '../subspace';

export let subspaceProviderListingGroupService = createSubspaceService(
  subspace.providerListingGroup,
  ['get', 'list', 'create', 'update', 'addListing', 'removeListing'],
  () => ({})
);
