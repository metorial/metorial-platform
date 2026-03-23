import { createSubspacePublicService } from '../lib/subspaceService';
import { subspace } from '../subspace';
export type SubspaceManagedProviderAuthCredentials = Awaited<
  ReturnType<typeof subspace.managedProviderAuthCredentials.get>
>;

export type ManagedProviderAuthCredentialsStatus =
  SubspaceManagedProviderAuthCredentials['status'];

export let subspaceManagedProviderAuthCredentialsService = createSubspacePublicService(
  subspace.managedProviderAuthCredentials,
  ['list', 'get', 'create', 'update', 'archive'],
  () => ({})
);
