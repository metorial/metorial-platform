import { createSubspacePublicService, createSubspaceService } from '../lib/subspaceService';
import { subspace } from '../subspace';

export let subspaceProviderAuthMethodService = createSubspaceService(
  subspace.providerAuthMethod,
  ['get', 'list'],
  () => ({})
);

export let subspacePublicProviderAuthMethodService = createSubspacePublicService(
  subspace.providerAuthMethod,
  ['list'],
  () => ({})
);

export type SubspaceProviderAuthMethod = Awaited<
  ReturnType<typeof subspace.providerAuthMethod.get>
>;
