import {
  Fabric,
  type AuditSubspaceFirewall,
  type AuditSubspaceIntegrationFirewallAssignment,
  type AuditSubspaceNetworkPolicy,
  type FabricEvents
} from '@metorial/fabric';
import { auditTrackerService } from '@metorial/module-audit-tracker';
import { getSubspaceAuditScope, recordSubspaceAuditEvent } from './_shared';

let firewallPayload = (firewall: AuditSubspaceFirewall) => ({
  id: firewall.id,
  status: firewall.status,
  slug: firewall.slug,
  name: firewall.name,
  description: firewall.description,
  internetGateway: { id: firewall.internetGateway.id, name: firewall.internetGateway.name },
  networkPolicies: (firewall.networkPolicyLinks ?? []).map(link => ({
    position: link.position,
    networkPolicy: { id: link.networkPolicy.id, name: link.networkPolicy.name }
  })),
  archivedAt: firewall.archivedAt
});

let firewallAssignmentPayload = (assignment: AuditSubspaceIntegrationFirewallAssignment) => ({
  id: assignment.id,
  targetType: assignment.targetType,
  firewall: {
    id: assignment.firewall.id,
    slug: assignment.firewall.slug,
    name: assignment.firewall.name
  },
  enclave: assignment.enclave
    ? {
        id: assignment.enclave.id,
        slug: assignment.enclave.slug,
        name: assignment.enclave.name
      }
    : null,
  provider: assignment.provider
    ? { id: assignment.provider.id, name: assignment.provider.name }
    : null,
  internetGateway: assignment.internetGateway
    ? { id: assignment.internetGateway.id, name: assignment.internetGateway.name }
    : null
});

let networkPolicyPayload = (
  networkPolicy: AuditSubspaceNetworkPolicy,
  changedRuleId: string | null = null
) => ({
  id: networkPolicy.id,
  status: networkPolicy.status,
  name: networkPolicy.name,
  description: networkPolicy.description,
  currentVersionId: networkPolicy.currentVersion?.id ?? null,
  currentVersionNumber: networkPolicy.currentVersionNumber,
  rules: networkPolicy.currentVersion?.rules ?? [],
  changedRuleId
});

export let recordFirewallCreated = async (
  event: FabricEvents['instance.network.firewall.created:after']
) => {
  let scope = getSubspaceAuditScope(event);
  if (!scope) return;

  await recordSubspaceAuditEvent(() =>
    auditTrackerService.recordEvent(scope, 'firewall', 'create', {
      payload: firewallPayload(event.firewall)
    })
  );
};

export let recordFirewallUpdated = async (
  event:
    | FabricEvents['instance.network.firewall.updated:after']
    | FabricEvents['instance.network.firewall.network_policy.attached:after']
    | FabricEvents['instance.network.firewall.network_policy.detached:after']
) => {
  let scope = getSubspaceAuditScope(event);
  if (!scope) return;

  await recordSubspaceAuditEvent(() =>
    auditTrackerService.recordEvent(scope, 'firewall', 'update', {
      payload: firewallPayload(event.firewall),
      previousPayload: firewallPayload(event.previousFirewall)
    })
  );
};

export let recordFirewallDeleted = async (
  event: FabricEvents['instance.network.firewall.deleted:after']
) => {
  let scope = getSubspaceAuditScope(event);
  if (!scope) return;

  await recordSubspaceAuditEvent(() =>
    auditTrackerService.recordEvent(scope, 'firewall', 'delete', {
      payload: firewallPayload(event.firewall)
    })
  );
};

export let recordFirewallAssignmentCreated = async (
  event: FabricEvents['instance.network.integration_firewall_assignment.created:after']
) => {
  let scope = getSubspaceAuditScope(event);
  if (!scope) return;

  await recordSubspaceAuditEvent(() =>
    auditTrackerService.recordEvent(scope, 'integration_firewall_assignment', 'create', {
      payload: firewallAssignmentPayload(event.firewallAssignment)
    })
  );
};

export let recordFirewallAssignmentDeleted = async (
  event: FabricEvents['instance.network.integration_firewall_assignment.deleted:after']
) => {
  let scope = getSubspaceAuditScope(event);
  if (!scope) return;

  await recordSubspaceAuditEvent(() =>
    auditTrackerService.recordEvent(scope, 'integration_firewall_assignment', 'delete', {
      payload: firewallAssignmentPayload(event.firewallAssignment)
    })
  );
};

export let recordNetworkPolicyCreated = async (
  event: FabricEvents['instance.network.network_policy.created:after']
) => {
  let scope = getSubspaceAuditScope(event);
  if (!scope) return;

  await recordSubspaceAuditEvent(() =>
    auditTrackerService.recordEvent(scope, 'network_policy', 'create', {
      payload: networkPolicyPayload(event.networkPolicy)
    })
  );
};

export let recordNetworkPolicyUpdated = async (
  event: FabricEvents['instance.network.network_policy.updated:after']
) => {
  let scope = getSubspaceAuditScope(event);
  if (!scope) return;

  await recordSubspaceAuditEvent(() =>
    auditTrackerService.recordEvent(scope, 'network_policy', 'update', {
      payload: networkPolicyPayload(event.networkPolicy),
      previousPayload: networkPolicyPayload(event.previousNetworkPolicy)
    })
  );
};

export let recordNetworkPolicyDeleted = async (
  event: FabricEvents['instance.network.network_policy.deleted:after']
) => {
  let scope = getSubspaceAuditScope(event);
  if (!scope) return;

  await recordSubspaceAuditEvent(() =>
    auditTrackerService.recordEvent(scope, 'network_policy', 'delete', {
      payload: networkPolicyPayload(event.networkPolicy)
    })
  );
};

export let recordNetworkPolicyRuleChanged = async (
  event:
    | FabricEvents['instance.network.network_policy.rule.created:after']
    | FabricEvents['instance.network.network_policy.rule.updated:after']
    | FabricEvents['instance.network.network_policy.rule.deleted:after']
) => {
  let scope = getSubspaceAuditScope(event);
  if (!scope) return;

  let changedRuleId = 'rule' in event ? event.rule.id : event.ruleId;

  await recordSubspaceAuditEvent(() =>
    auditTrackerService.recordEvent(scope, 'network_policy', 'update', {
      payload: networkPolicyPayload(event.networkPolicy, changedRuleId),
      previousPayload: networkPolicyPayload(event.previousNetworkPolicy, changedRuleId)
    })
  );
};

Fabric.listen('instance.network.firewall.created:after', recordFirewallCreated);
Fabric.listen('instance.network.firewall.updated:after', recordFirewallUpdated);
Fabric.listen('instance.network.firewall.deleted:after', recordFirewallDeleted);
Fabric.listen(
  'instance.network.firewall.network_policy.attached:after',
  recordFirewallUpdated
);
Fabric.listen(
  'instance.network.firewall.network_policy.detached:after',
  recordFirewallUpdated
);

Fabric.listen(
  'instance.network.integration_firewall_assignment.created:after',
  recordFirewallAssignmentCreated
);
Fabric.listen(
  'instance.network.integration_firewall_assignment.deleted:after',
  recordFirewallAssignmentDeleted
);

Fabric.listen('instance.network.network_policy.created:after', recordNetworkPolicyCreated);
Fabric.listen('instance.network.network_policy.updated:after', recordNetworkPolicyUpdated);
Fabric.listen('instance.network.network_policy.deleted:after', recordNetworkPolicyDeleted);
Fabric.listen(
  'instance.network.network_policy.rule.created:after',
  recordNetworkPolicyRuleChanged
);
Fabric.listen(
  'instance.network.network_policy.rule.updated:after',
  recordNetworkPolicyRuleChanged
);
Fabric.listen(
  'instance.network.network_policy.rule.deleted:after',
  recordNetworkPolicyRuleChanged
);
