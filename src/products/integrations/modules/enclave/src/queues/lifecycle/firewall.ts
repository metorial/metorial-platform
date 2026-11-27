import { createQueue } from '@lowerdeck/queue';
import { resetCompiledNetworkRulesForFirewallId } from '../../lib/resetCompiledNetworkRules';
import { env } from '../../env';

export let firewallUpdatedQueue = createQueue<{ firewallId: string }>({
  name: 'sub/enc/lc/firewall/updated',
  workerOpts: { concurrency: 10 },
  redisUrl: env.service.REDIS_URL
});

export let firewallUpdatedQueueProcessor = firewallUpdatedQueue.process(async data => {
  await resetCompiledNetworkRulesForFirewallId(data.firewallId);
});
