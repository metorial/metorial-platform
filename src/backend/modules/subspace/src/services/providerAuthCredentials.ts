import { createSubspaceService } from '../lib/subspaceService';
import { subspace } from '../subspace';

export let subspaceProviderAuthCredentialsService = createSubspaceService(
  subspace.providerAuthCredentials,
  ['get', 'list', 'update', 'create'],
  () => ({})
);

export type SubspaceProviderAuthCredentials = Awaited<
  ReturnType<typeof subspace.providerAuthCredentials.get>
>;
