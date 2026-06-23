import { Fabric } from '@metorial/fabric';
import { createSubspaceService, toEventBase } from '../lib/subspaceService';
import { subspace } from '../subspace';

export let subspaceFirewallService = createSubspaceService(
  subspace.firewall,
  ['get', 'list', 'create', 'update', 'delete', 'addNetworkPolicy', 'removeNetworkPolicy'],
  inner => ({
    create: async (...params: Parameters<typeof inner.create>) => {
      let eventBase = toEventBase(params[0]);
      await Fabric.fire('instance.network.firewall.created:before', eventBase);

      let firewall = await inner.create(...params);

      await Fabric.fire('instance.network.firewall.created:after', { ...eventBase, firewall });

      return firewall;
    },
    update: async (...params: Parameters<typeof inner.update>) => {
      let eventBase = toEventBase(params[0]);
      await Fabric.fire('instance.network.firewall.updated:before', eventBase);

      let firewall = await inner.update(...params);

      await Fabric.fire('instance.network.firewall.updated:after', { ...eventBase, firewall });

      return firewall;
    },
    delete: async (...params: Parameters<typeof inner.delete>) => {
      let eventBase = toEventBase(params[0]);
      await Fabric.fire('instance.network.firewall.deleted:before', eventBase);

      let firewall = await inner.delete(...params);

      await Fabric.fire('instance.network.firewall.deleted:after', { ...eventBase, firewall });

      return firewall;
    },
    addNetworkPolicy: async (...params: Parameters<typeof inner.addNetworkPolicy>) => {
      let eventBase = toEventBase(params[0]);
      await Fabric.fire('instance.network.firewall.network_policy.attached:before', eventBase);

      let firewall = await inner.addNetworkPolicy(...params);

      await Fabric.fire('instance.network.firewall.network_policy.attached:after', {
        ...eventBase,
        firewall
      });

      return firewall;
    },
    removeNetworkPolicy: async (...params: Parameters<typeof inner.removeNetworkPolicy>) => {
      let eventBase = toEventBase(params[0]);
      await Fabric.fire('instance.network.firewall.network_policy.detached:before', eventBase);

      let firewall = await inner.removeNetworkPolicy(...params);

      await Fabric.fire('instance.network.firewall.network_policy.detached:after', {
        ...eventBase,
        firewall
      });

      return firewall;
    }
  })
);

export type SubspaceFirewall = Awaited<ReturnType<typeof subspace.firewall.get>>;
