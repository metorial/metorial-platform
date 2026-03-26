import { createSubspacePublicService, createSubspaceService } from '../lib/subspaceService';
import { subspace } from '../subspace';

export let subspaceProviderTriggerService = createSubspaceService(
  subspace.providerTrigger,
  ['get', 'list'],
  () => ({})
);

export let subspacePublicProviderTriggerService = createSubspacePublicService(
  subspace.providerTrigger,
  ['get', 'list'],
  () => ({})
);

export type SubspaceProviderTrigger = Awaited<ReturnType<typeof subspace.providerTrigger.get>>;
export type SubspaceProviderTriggerList = Awaited<
  ReturnType<typeof subspace.providerTrigger.list>
>;
export type SubspaceProviderTriggerListItem = SubspaceProviderTriggerList['items'][number];
