import { createSubspacePublicService, createSubspaceService } from '../lib/subspaceService';
import { subspace } from '../subspace';

export let subspaceProviderVersionService = createSubspaceService(
  subspace.providerVersion,
  ['get', 'list'],
  () => ({})
);

export let subspacePublicProviderVersionService = createSubspacePublicService(
  subspace.providerVersion,
  ['get', 'list'],
  () => ({})
);

export type SubspaceProviderVersion = Awaited<ReturnType<typeof subspace.providerVersion.get>>;
export type SubspaceProviderVersionList = Awaited<
  ReturnType<typeof subspace.providerVersion.list>
>;
export type SubspaceProviderVersionListItem = SubspaceProviderVersionList['items'][number];
