import { db, Prisma } from '@metorial-subspace/db';

export type FirewallAssignmentTarget = {
  enclaveOid: bigint | null;
  providerOid: bigint | null;
  internetGatewayOid: bigint | null;
};

export let resetCompiledNetworkRulesForBindingTargets = async (d: {
  internetGatewayOid: bigint;
  tenantOid: bigint;
  environmentOid: bigint;
  assignments: FirewallAssignmentTarget[];
}) => {
  if (d.assignments.length === 0) return;

  let enclaveOids = new Set<bigint>();
  let providerOids = new Set<bigint>();
  let hasInternetGatewayAssignment = false;

  for (let assignment of d.assignments) {
    if (assignment.enclaveOid) enclaveOids.add(assignment.enclaveOid);
    if (assignment.providerOid) providerOids.add(assignment.providerOid);
    if (assignment.internetGatewayOid) hasInternetGatewayAssignment = true;
  }

  let orConditions: Prisma.IntegrationEnclaveWhereInput[] = [];

  if (enclaveOids.size > 0) {
    orConditions.push({ oid: { in: [...enclaveOids] } });
  }
  if (providerOids.size > 0) {
    orConditions.push({
      providerDeployment: { providerOid: { in: [...providerOids] } }
    });
  }
  if (hasInternetGatewayAssignment) {
    orConditions.push({ internetGatewayOid: d.internetGatewayOid });
  }

  if (orConditions.length === 0) return;

  await db.integrationEnclave.updateMany({
    where: {
      internetGatewayOid: d.internetGatewayOid,
      tenantOid: d.tenantOid,
      environmentOid: d.environmentOid,
      OR: orConditions
    },
    data: {
      compiledNetworkRules: Prisma.JsonNull,
      needsEnclaveReconciliation: true
    }
  });
};

export let resetCompiledNetworkRulesForFirewall = async (firewall: {
  internetGatewayOid: bigint;
  tenantOid: bigint;
  environmentOid: bigint;
  assignments: FirewallAssignmentTarget[];
}) => {
  if (firewall.assignments.length === 0) return;

  await resetCompiledNetworkRulesForBindingTargets({
    internetGatewayOid: firewall.internetGatewayOid,
    tenantOid: firewall.tenantOid,
    environmentOid: firewall.environmentOid,
    assignments: firewall.assignments
  });
};

export let resetCompiledNetworkRulesForFirewallId = async (firewallId: string) => {
  let firewall = await db.firewall.findFirst({
    where: { id: firewallId },
    include: { assignments: true }
  });
  if (!firewall) return false;

  await resetCompiledNetworkRulesForFirewall(firewall);

  return true;
};
