import { createSubspaceService } from '../lib/subspaceService';
import { subspace } from '../subspace';

export let subspaceProviderAuthMethodService = createSubspaceService(
  subspace.providerAuthMethod,
  ['get', 'list'],
  () => ({})
);

export type SubspaceProviderAuthMethod = Awaited<
  ReturnType<typeof subspace.providerAuthMethod.get>
>;
