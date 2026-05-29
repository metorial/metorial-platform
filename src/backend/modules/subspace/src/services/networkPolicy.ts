import { createSubspaceService } from '../lib/subspaceService';
import { subspace } from '../subspace';

export let subspaceNetworkPolicyService = createSubspaceService(
  subspace.networkPolicy,
  ['get', 'list', 'create', 'update', 'delete', 'addRule', 'removeRule'],
  () => ({})
);

export type SubspaceNetworkPolicy = Awaited<
  ReturnType<typeof subspace.networkPolicy.get>
>;

export type SubspaceNetworkPolicyRule = Awaited<
  ReturnType<typeof subspace.networkPolicy.addRule>
>['rule'];
