import { createSubspaceService } from '../lib/subspaceService';
import { subspace } from '../subspace';

export let subspaceProviderVariantService = createSubspaceService(
  subspace.providerVariant,
  ['get', 'list'],
  () => ({})
);

export type SubspaceProviderVariant = Awaited<ReturnType<typeof subspace.providerVariant.get>>;
