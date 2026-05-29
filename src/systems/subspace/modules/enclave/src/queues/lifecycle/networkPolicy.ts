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
