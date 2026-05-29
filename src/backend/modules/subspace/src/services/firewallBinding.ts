import { Fabric } from '@metorial/fabric';
import { createSubspaceService, toEventBase } from '../lib/subspaceService';
import { subspace } from '../subspace';

export let subspaceFirewallBindingService = createSubspaceService(
  subspace.firewallBinding,
  ['get', 'list', 'create', 'delete'],
  inner => ({
    create: async (...params: Parameters<typeof inner.create>) => {
      let eventBase = toEventBase(params[0]);
      await Fabric.fire('instance.network.firewall_binding.created:before', eventBase);

      let firewallBinding = await inner.create(...params);

      await Fabric.fire('instance.network.firewall_binding.created:after', {
        ...eventBase,
        firewallBinding
      });

      return firewallBinding;
    },
    delete: async (...params: Parameters<typeof inner.delete>) => {
      let eventBase = toEventBase(params[0]);
      await Fabric.fire('instance.network.firewall_binding.deleted:before', eventBase);

      let firewallBinding = await inner.delete(...params);

      await Fabric.fire('instance.network.firewall_binding.deleted:after', {
        ...eventBase,
        firewallBinding
      });

      return firewallBinding;
    }
  })
);

export type SubspaceFirewallBinding = Awaited<ReturnType<typeof subspace.firewallBinding.get>>;
