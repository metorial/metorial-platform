import { createQueue } from '@lowerdeck/queue';
import { db, Prisma } from '@metorial-subspace/db';
import { env } from '../../env';

type FirewallWithBindings = {
  oid: bigint;
  networkOid: bigint;
  tenantOid: bigint;
  environmentOid: bigint;
  bindings: {
    enclaveOid: bigint | null;
    providerOid: bigint | null;
    networkOid: bigint | null;
  }[];
};

let resetCompiledNetworkRulesForFirewall = async (firewall: FirewallWithBindings) => {
  if (firewall.bindings.length === 0) return;

  let enclaveOids = new Set<bigint>();
  let providerOids = new Set<bigint>();
  let hasNetworkBinding = false;

  for (let binding of firewall.bindings) {
    if (binding.enclaveOid) enclaveOids.add(binding.enclaveOid);
    if (binding.providerOid) providerOids.add(binding.providerOid);
    if (binding.networkOid) hasNetworkBinding = true;
  }

  let orConditions: Prisma.EnclaveWhereInput[] = [];

  if (enclaveOids.size > 0) {
    orConditions.push({ oid: { in: [...enclaveOids] } });
  }
  if (providerOids.size > 0) {
    orConditions.push({
      providerDeployment: { providerOid: { in: [...providerOids] } }
    });
  }
  if (hasNetworkBinding) {
    orConditions.push({ networkOid: firewall.networkOid });
  }

  if (orConditions.length === 0) return;

  await db.enclave.updateMany({
    where: {
      networkOid: firewall.networkOid,
      tenantOid: firewall.tenantOid,
      environmentOid: firewall.environmentOid,
      OR: orConditions
    },
    data: { compiledNetworkRules: Prisma.JsonNull }
  });
};

let resetCompiledNetworkRulesForFirewallId = async (firewallId: string) => {
  let firewall = await db.firewall.findFirst({
    where: { id: firewallId },
    include: { bindings: true }
  });
  if (!firewall) return false;

  await resetCompiledNetworkRulesForFirewall(firewall);

  return true;
};

export let firewallCreatedQueue = createQueue<{ firewallId: string }>({
  name: 'sub/enc/lc/firewall/created',
  redisUrl: env.service.REDIS_URL
});

export let firewallCreatedQueueProcessor = firewallCreatedQueue.process(async data => {
  await resetCompiledNetworkRulesForFirewallId(data.firewallId);
});

export let firewallUpdatedQueue = createQueue<{ firewallId: string }>({
  name: 'sub/enc/lc/firewall/updated',
  redisUrl: env.service.REDIS_URL
});

export let firewallUpdatedQueueProcessor = firewallUpdatedQueue.process(async data => {
  await resetCompiledNetworkRulesForFirewallId(data.firewallId);
});

export let firewallDeletedQueue = createQueue<{ firewallId: string }>({
  name: 'sub/enc/lc/firewall/deleted',
  redisUrl: env.service.REDIS_URL
});

export let firewallDeletedQueueProcessor = firewallDeletedQueue.process(async data => {
  await resetCompiledNetworkRulesForFirewallId(data.firewallId);
});
