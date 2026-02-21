import { createSubspacePublicService, createSubspaceService } from '../lib/subspaceService';
import { subspace } from '../subspace';

export let subspaceProviderToolService = createSubspaceService(
  subspace.providerTool,
  ['get', 'list'],
  () => ({})
);

export let subspacePublicProviderToolService = createSubspacePublicService(
  subspace.providerTool,
  ['get', 'list'],
  () => ({})
);

export type SubspaceProviderTool = Awaited<ReturnType<typeof subspace.providerTool.get>>;
export type SubspaceProviderToolList = Awaited<ReturnType<typeof subspace.providerTool.list>>;
export type SubspaceProviderToolListItem = SubspaceProviderToolList['items'][number];
