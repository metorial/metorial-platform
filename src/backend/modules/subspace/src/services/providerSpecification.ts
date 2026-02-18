import { createSubspaceService } from '../lib/subspaceService';
import { subspace } from '../subspace';

export let subspaceProviderSpecificationService = createSubspaceService(
  subspace.providerSpecification,
  ['get', 'list'],
  () => ({})
);

export type SubspaceProviderSpecification = Awaited<ReturnType<typeof subspace.providerSpecification.get>>;
