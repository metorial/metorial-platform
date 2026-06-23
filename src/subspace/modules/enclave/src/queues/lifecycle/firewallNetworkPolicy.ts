import { createQueue } from '@lowerdeck/queue';
import { resetCompiledNetworkRulesForFirewallId } from '../../lib/resetCompiledNetworkRules';
import { env } from '../../env';

export let firewallNetworkPolicyLinksUpdatedQueue = createQueue<{ firewallId: string }>({
  name: 'sub/enc/lc/firewall/networkPolicyLinks/updated',
  redisUrl: env.service.REDIS_URL
});

export let firewallNetworkPolicyLinksUpdatedQueueProcessor =
  firewallNetworkPolicyLinksUpdatedQueue.process(async data => {
    await resetCompiledNetworkRulesForFirewallId(data.firewallId);
  });
