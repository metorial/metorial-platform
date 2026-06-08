import { Fabric } from '@metorial/fabric';
import { createSubspaceService, toEventBase } from '../lib/subspaceService';
import { subspace } from '../subspace';

export let subspaceNetworkPolicyService = createSubspaceService(
  subspace.networkPolicy,
  ['get', 'list', 'create', 'update', 'delete', 'addRule', 'updateRule', 'removeRule'],
  inner => ({
    create: async (...params: Parameters<typeof inner.create>) => {
      let eventBase = toEventBase(params[0]);
      await Fabric.fire('instance.network.network_policy.created:before', eventBase);

      let networkPolicy = await inner.create(...params);

      await Fabric.fire('instance.network.network_policy.created:after', {
        ...eventBase,
        networkPolicy
      });

      return networkPolicy;
    },
    update: async (...params: Parameters<typeof inner.update>) => {
      let eventBase = toEventBase(params[0]);
      await Fabric.fire('instance.network.network_policy.updated:before', eventBase);

      let networkPolicy = await inner.update(...params);

      await Fabric.fire('instance.network.network_policy.updated:after', {
        ...eventBase,
        networkPolicy
      });

      return networkPolicy;
    },
    delete: async (...params: Parameters<typeof inner.delete>) => {
      let eventBase = toEventBase(params[0]);
      await Fabric.fire('instance.network.network_policy.deleted:before', eventBase);

      let networkPolicy = await inner.delete(...params);

      await Fabric.fire('instance.network.network_policy.deleted:after', {
        ...eventBase,
        networkPolicy
      });

      return networkPolicy;
    },
    addRule: async (...params: Parameters<typeof inner.addRule>) => {
      let eventBase = toEventBase(params[0]);
      await Fabric.fire('instance.network.network_policy.rule.created:before', eventBase);

      let result = await inner.addRule(...params);

      await Fabric.fire('instance.network.network_policy.rule.created:after', {
        ...eventBase,
        networkPolicy: result.networkPolicy,
        rule: result.rule
      });

      return result;
    },
    updateRule: async (...params: Parameters<typeof inner.updateRule>) => {
      let eventBase = toEventBase(params[0]);
      await Fabric.fire('instance.network.network_policy.rule.updated:before', eventBase);

      let result = await inner.updateRule(...params);

      await Fabric.fire('instance.network.network_policy.rule.updated:after', {
        ...eventBase,
        networkPolicy: result.networkPolicy,
        rule: result.rule
      });

      return result;
    },
    removeRule: async (...params: Parameters<typeof inner.removeRule>) => {
      let eventBase = toEventBase(params[0]);
      await Fabric.fire('instance.network.network_policy.rule.deleted:before', eventBase);

      let networkPolicy = await inner.removeRule(...params);

      await Fabric.fire('instance.network.network_policy.rule.deleted:after', {
        ...eventBase,
        networkPolicy
      });

      return networkPolicy;
    }
  })
);

export type SubspaceNetworkPolicy = Awaited<ReturnType<typeof subspace.networkPolicy.get>>;

export type SubspaceNetworkPolicyRule = Awaited<
  ReturnType<typeof subspace.networkPolicy.addRule>
>['rule'];
