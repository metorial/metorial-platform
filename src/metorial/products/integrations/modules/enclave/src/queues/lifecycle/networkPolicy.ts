import { createQueue } from '@lowerdeck/queue';
import { db } from '@metorial-subspace/db';
import { resetCompiledNetworkRulesForFirewall } from '../../lib/resetCompiledNetworkRules';
import { env } from '../../env';

let resetCompiledNetworkRulesForNetworkPolicyId = async (networkPolicyId: string) => {
  let networkPolicy = await db.networkPolicy.findFirst({
    where: { id: networkPolicyId },
    include: {
      firewallLinks: {
        include: {
          firewall: {
            include: { bindings: true }
          }
        }
      }
    }
  });
  if (!networkPolicy) return false;

  let resetFirewallOids = new Set<bigint>();

  for (let link of networkPolicy.firewallLinks) {
    if (resetFirewallOids.has(link.firewall.oid)) continue;
    resetFirewallOids.add(link.firewall.oid);
    await resetCompiledNetworkRulesForFirewall(link.firewall);
  }

  return true;
};

export let networkPolicyCreatedQueue = createQueue<{ networkPolicyId: string }>({
  name: 'sub/enc/lc/networkPolicy/created',
  redisUrl: env.service.REDIS_URL
});

export let networkPolicyCreatedQueueProcessor = networkPolicyCreatedQueue.process(
  async data => {
    await resetCompiledNetworkRulesForNetworkPolicyId(data.networkPolicyId);
  }
);

export let networkPolicyUpdatedQueue = createQueue<{ networkPolicyId: string }>({
  name: 'sub/enc/lc/networkPolicy/updated',
  redisUrl: env.service.REDIS_URL
});

export let networkPolicyUpdatedQueueProcessor = networkPolicyUpdatedQueue.process(
  async data => {
    await resetCompiledNetworkRulesForNetworkPolicyId(data.networkPolicyId);
  }
);

export let networkPolicyDeletedQueue = createQueue<{ networkPolicyId: string }>({
  name: 'sub/enc/lc/networkPolicy/deleted',
  redisUrl: env.service.REDIS_URL
});

export let networkPolicyDeletedQueueProcessor = networkPolicyDeletedQueue.process(
  async data => {
    await resetCompiledNetworkRulesForNetworkPolicyId(data.networkPolicyId);
  }
);
