import { createSubspaceService } from '../lib/subspaceService';
import { subspace } from '../subspace';

export let subspaceBrandService = createSubspaceService(
  subspace.brand,
  ['get', 'upsert'],
  () => ({})
);

export type SubspaceBrand = Awaited<ReturnType<typeof subspace.brand.get>>;
