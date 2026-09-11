import { v } from '@lowerdeck/validation';
import { resource } from '@metorial/audit-stash';

export type SubspaceFirewallPolicyLinkSummary = {
  position: number;
  networkPolicy: { id: string; name: string };
};

export let firewallAuditResource = resource({
  name: 'firewall',
  payload: v.typedAny<{
    id: string;
    status: string;
    slug: string;
    name: string;
    description: string | null;
    network: { id: string; name: string };
    networkPolicies: SubspaceFirewallPolicyLinkSummary[];
    archivedAt: Date | null;
  }>('firewall'),
  presenter: undefined,
  actions: {
    create: true,
    update: true,
    delete: true
  }
});

export let firewallBindingAuditResource = resource({
  name: 'firewall_binding',
  payload: v.typedAny<{
    id: string;
    targetType: string;
    firewall: { id: string; slug: string; name: string };
    enclave: { id: string; slug: string; name: string } | null;
    provider: { id: string; name: string } | null;
    network: { id: string; name: string } | null;
  }>('firewall_binding'),
  presenter: undefined,
  actions: {
    create: true,
    delete: true
  }
});

export let networkPolicyAuditResource = resource({
  name: 'network_policy',
  payload: v.typedAny<{
    id: string;
    status: string;
    name: string;
    description: string | null;
    currentVersionId: string | null;
    currentVersionNumber: number;
    rules: unknown;
    changedRuleId: string | null;
  }>('network_policy'),
  presenter: undefined,
  actions: {
    create: true,
    update: true,
    delete: true
  }
});
