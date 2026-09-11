import { createQueue } from '@lowerdeck/queue';
import { db } from '@metorial-subspace/db';
import { resetCompiledNetworkRulesForBindingTargets } from '../../lib/resetCompiledNetworkRules';
import { env } from '../../env';

export type FirewallBindingLifecycleTarget = {
  firewallNetworkOid: string;
  tenantOid: string;
  environmentOid: string;
  enclaveOid: string | null;
  providerOid: string | null;
  bindingNetworkOid: string | null;
};

let resetCompiledNetworkRulesForBindingTarget = async (
  target: FirewallBindingLifecycleTarget
) => {
  await resetCompiledNetworkRulesForBindingTargets({
    networkOid: BigInt(target.firewallNetworkOid),
    tenantOid: BigInt(target.tenantOid),
    environmentOid: BigInt(target.environmentOid),
    bindings: [
      {
        enclaveOid: target.enclaveOid ? BigInt(target.enclaveOid) : null,
        providerOid: target.providerOid ? BigInt(target.providerOid) : null,
        networkOid: target.bindingNetworkOid ? BigInt(target.bindingNetworkOid) : null
      }
    ]
  });
};

let resetCompiledNetworkRulesForBindingId = async (firewallBindingId: string) => {
  let binding = await db.firewallBinding.findFirst({
    where: { id: firewallBindingId },
    include: {
      firewall: {
        select: {
          networkOid: true
        }
      }
    }
  });
  if (!binding) return false;

  await resetCompiledNetworkRulesForBindingTarget({
    firewallNetworkOid: binding.firewall.networkOid.toString(),
    tenantOid: binding.tenantOid.toString(),
    environmentOid: binding.environmentOid.toString(),
    enclaveOid: binding.enclaveOid?.toString() ?? null,
    providerOid: binding.providerOid?.toString() ?? null,
    bindingNetworkOid: binding.networkOid?.toString() ?? null
  });

  return true;
};

export let firewallBindingCreatedQueue = createQueue<{ firewallBindingId: string }>({
  name: 'sub/enc/lc/firewallBinding/created',
  redisUrl: env.service.REDIS_URL
});

export let firewallBindingCreatedQueueProcessor = firewallBindingCreatedQueue.process(
  async data => {
    await resetCompiledNetworkRulesForBindingId(data.firewallBindingId);
  }
);

export let firewallBindingDeletedQueue = createQueue<FirewallBindingLifecycleTarget>({
  name: 'sub/enc/lc/firewallBinding/deleted',
  redisUrl: env.service.REDIS_URL
});

export let firewallBindingDeletedQueueProcessor = firewallBindingDeletedQueue.process(
  async data => {
    await resetCompiledNetworkRulesForBindingTarget(data);
  }
);
