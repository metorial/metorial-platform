import { db, Prisma } from '@metorial-subspace/db';

export type FirewallBindingTarget = {
  enclaveOid: bigint | null;
  providerOid: bigint | null;
  networkOid: bigint | null;
};

export let resetCompiledNetworkRulesForBindingTargets = async (d: {
  networkOid: bigint;
  tenantOid: bigint;
  environmentOid: bigint;
  bindings: FirewallBindingTarget[];
}) => {
  if (d.bindings.length === 0) return;

  let enclaveOids = new Set<bigint>();
  let providerOids = new Set<bigint>();
  let hasNetworkBinding = false;

  for (let binding of d.bindings) {
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
    orConditions.push({ networkOid: d.networkOid });
  }

  if (orConditions.length === 0) return;

  await db.enclave.updateMany({
    where: {
      networkOid: d.networkOid,
      tenantOid: d.tenantOid,
      environmentOid: d.environmentOid,
      OR: orConditions
    },
    data: { compiledNetworkRules: Prisma.JsonNull }
  });
};

export let resetCompiledNetworkRulesForFirewall = async (firewall: {
  networkOid: bigint;
  tenantOid: bigint;
  environmentOid: bigint;
  bindings: FirewallBindingTarget[];
}) => {
  if (firewall.bindings.length === 0) return;

  await resetCompiledNetworkRulesForBindingTargets({
    networkOid: firewall.networkOid,
    tenantOid: firewall.tenantOid,
    environmentOid: firewall.environmentOid,
    bindings: firewall.bindings
  });
};

export let resetCompiledNetworkRulesForFirewallId = async (firewallId: string) => {
  let firewall = await db.firewall.findFirst({
    where: { id: firewallId },
    include: { bindings: true }
  });
  if (!firewall) return false;

  await resetCompiledNetworkRulesForFirewall(firewall);

  return true;
};
