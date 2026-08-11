import { createSubspaceService } from '../lib/subspaceService';
import { subspace } from '../subspace';

export let subspaceFirewallBindingService = createSubspaceService(
  subspace.firewallBinding,
  ['get', 'list', 'create', 'delete'],
  () => ({})
);

export type SubspaceFirewallBinding = Awaited<ReturnType<typeof subspace.firewallBinding.get>>;
