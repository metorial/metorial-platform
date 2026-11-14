import { Fabric } from '@metorial/fabric';
import {
  egressFirewallChangedManyQueue,
  egressNetworkPolicyChangedManyQueue
} from '../queues/egress';

Fabric.listen('networking.firewall.changed:after', async ({ firewallId }) => {
  await egressFirewallChangedManyQueue.add({ firewallId });
});

Fabric.listen('networking.network_policy.changed:after', async ({ networkPolicyId }) => {
  await egressNetworkPolicyChangedManyQueue.add({ networkPolicyId });
});
