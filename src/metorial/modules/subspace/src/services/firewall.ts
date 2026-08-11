import { createSubspaceService } from '../lib/subspaceService';
import { subspace } from '../subspace';

export let subspaceFirewallService = createSubspaceService(
  subspace.firewall,
  ['get', 'list', 'create', 'update', 'delete', 'addNetworkPolicy', 'removeNetworkPolicy'],
  () => ({})
);

export type SubspaceFirewall = Awaited<ReturnType<typeof subspace.firewall.get>>;
