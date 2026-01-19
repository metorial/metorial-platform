import { createSubspaceService } from '../lib/subspaceService';
import { subspace } from '../subspace';

export let subspaceProviderListingService = createSubspaceService(
  subspace.providerListing,
  ['get', 'list'],
  () => ({})
);
