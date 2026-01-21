import { createSubspaceService } from '../lib/subspaceService';
import { subspace } from '../subspace';

export let subspaceProviderVariantService = createSubspaceService(
  subspace.providerVariant,
  ['get', 'list'],
  () => ({})
);
