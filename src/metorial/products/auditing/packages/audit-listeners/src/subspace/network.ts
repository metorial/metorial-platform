import {
  Fabric,
  type AuditSubspaceFirewall,
  type AuditSubspaceFirewallBinding,
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
  network: { id: firewall.network.id, name: firewall.network.name },
  networkPolicies: (firewall.networkPolicyLinks ?? []).map(link => ({
    position: link.position,
    networkPolicy: { id: link.networkPolicy.id, name: link.networkPolicy.name }
  })),
  archivedAt: firewall.archivedAt
});

let firewallBindingPayload = (binding: AuditSubspaceFirewallBinding) => ({
  id: binding.id,
  targetType: binding.targetType,
  firewall: {
    id: binding.firewall.id,
    slug: binding.firewall.slug,
    name: binding.firewall.name
  },
  enclave: binding.enclave
    ? { id: binding.enclave.id, slug: binding.enclave.slug, name: binding.enclave.name }
    : null,
  provider: binding.provider ? { id: binding.provider.id, name: binding.provider.name } : null,
  network: binding.network ? { id: binding.network.id, name: binding.network.name } : null
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

export let recordFirewallBindingCreated = async (
  event: FabricEvents['instance.network.firewall_binding.created:after']
) => {
  let scope = getSubspaceAuditScope(event);
  if (!scope) return;

  await recordSubspaceAuditEvent(() =>
    auditTrackerService.recordEvent(scope, 'firewall_binding', 'create', {
      payload: firewallBindingPayload(event.firewallBinding)
    })
  );
};

export let recordFirewallBindingDeleted = async (
  event: FabricEvents['instance.network.firewall_binding.deleted:after']
) => {
  let scope = getSubspaceAuditScope(event);
  if (!scope) return;

  await recordSubspaceAuditEvent(() =>
    auditTrackerService.recordEvent(scope, 'firewall_binding', 'delete', {
      payload: firewallBindingPayload(event.firewallBinding)
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

Fabric.listen('instance.network.firewall_binding.created:after', recordFirewallBindingCreated);
Fabric.listen('instance.network.firewall_binding.deleted:after', recordFirewallBindingDeleted);

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
