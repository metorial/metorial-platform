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
            include: { assignments: true }
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

export let networkPolicyUpdatedQueue = createQueue<{ networkPolicyId: string }>({
  name: 'sub/enc/lc/networkPolicy/updated',
  workerOpts: { concurrency: 10 },
  redisUrl: env.service.REDIS_URL
});

export let networkPolicyUpdatedQueueProcessor = networkPolicyUpdatedQueue.process(
  async data => {
    await resetCompiledNetworkRulesForNetworkPolicyId(data.networkPolicyId);
  }
);
