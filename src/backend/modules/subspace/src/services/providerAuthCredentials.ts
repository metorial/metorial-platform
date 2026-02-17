import { createSubspaceService } from '../lib/subspaceService';
import { subspace } from '../subspace';

export let subspaceProviderAuthCredentialsService = createSubspaceService(
  subspace.providerAuthCredentials,
  ['get', 'list', 'update', 'create'],
  () => ({})
);

export type ProviderAuthCredentials = Awaited<
  ReturnType<typeof subspace.providerAuthCredentials.get>
>;
