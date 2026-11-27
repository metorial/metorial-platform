import { Fabric } from '@metorial/fabric';
import { firewallUpdatedQueue } from '../queues/lifecycle/firewall';
import { networkPolicyUpdatedQueue } from '../queues/lifecycle/networkPolicy';

Fabric.listen('networking.firewall.mirrored:after', async ({ firewallId }) => {
  await firewallUpdatedQueue.add({ firewallId });
});

Fabric.listen('networking.network_policy.mirrored:after', async ({ networkPolicyId }) => {
  await networkPolicyUpdatedQueue.add({ networkPolicyId });
});
