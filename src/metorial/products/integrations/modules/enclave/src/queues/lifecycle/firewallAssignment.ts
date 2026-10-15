import { createQueue } from '@lowerdeck/queue';
import { db } from '@metorial-subspace/db';
import { resetCompiledNetworkRulesForBindingTargets } from '../../lib/resetCompiledNetworkRules';
import { env } from '../../env';

export type FirewallAssignmentLifecycleTarget = {
  firewallInternetGatewayOid: string;
  tenantOid: string;
  environmentOid: string;
  enclaveOid: string | null;
  providerOid: string | null;
  assignmentInternetGatewayOid: string | null;
};

let resetCompiledNetworkRulesForBindingTarget = async (
  target: FirewallAssignmentLifecycleTarget
) => {
  await resetCompiledNetworkRulesForBindingTargets({
    internetGatewayOid: BigInt(target.firewallInternetGatewayOid),
    tenantOid: BigInt(target.tenantOid),
    environmentOid: BigInt(target.environmentOid),
    assignments: [
      {
        enclaveOid: target.enclaveOid ? BigInt(target.enclaveOid) : null,
        providerOid: target.providerOid ? BigInt(target.providerOid) : null,
        internetGatewayOid: target.assignmentInternetGatewayOid
          ? BigInt(target.assignmentInternetGatewayOid)
          : null
      }
    ]
  });
};

let resetCompiledNetworkRulesForBindingId = async (firewallAssignmentId: string) => {
  let assignment = await db.integrationFirewallAssignment.findFirst({
    where: { id: firewallAssignmentId },
    include: {
      firewall: {
        select: {
          internetGatewayOid: true
        }
      }
    }
  });
  if (!assignment) return false;

  await resetCompiledNetworkRulesForBindingTarget({
    firewallInternetGatewayOid: assignment.firewall.internetGatewayOid.toString(),
    tenantOid: assignment.tenantOid.toString(),
    environmentOid: assignment.environmentOid.toString(),
    enclaveOid: assignment.enclaveOid?.toString() ?? null,
    providerOid: assignment.providerOid?.toString() ?? null,
    assignmentInternetGatewayOid: assignment.internetGatewayOid?.toString() ?? null
  });

  return true;
};

export let firewallAssignmentCreatedQueue = createQueue<{ firewallAssignmentId: string }>({
  name: 'sub/enc/lc/firewallAssignment/created',
  workerOpts: { concurrency: 10 },
  redisUrl: env.service.REDIS_URL
});

export let firewallAssignmentCreatedQueueProcessor = firewallAssignmentCreatedQueue.process(
  async data => {
    await resetCompiledNetworkRulesForBindingId(data.firewallAssignmentId);
  }
);

export let firewallAssignmentDeletedQueue = createQueue<FirewallAssignmentLifecycleTarget>({
  name: 'sub/enc/lc/firewallAssignment/deleted',
  workerOpts: { concurrency: 10 },
  redisUrl: env.service.REDIS_URL
});

export let firewallAssignmentDeletedQueueProcessor = firewallAssignmentDeletedQueue.process(
  async data => {
    await resetCompiledNetworkRulesForBindingTarget(data);
  }
);
