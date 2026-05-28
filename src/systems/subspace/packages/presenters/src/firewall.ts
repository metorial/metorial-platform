import type {
  Firewall,
  FirewallBinding,
  FirewallNetworkPolicy,
  NetworkPolicy,
  NetworkPolicyVersion
} from '@metorial-subspace/db';
import { networkPolicyRulesPresenter } from './networkPolicyRule';

let presentFirewallBinding = (
  binding: FirewallBinding & {
    enclave?: { id: string } | null;
    provider?: { id: string } | null;
    network?: { id: string } | null;
  }
) => ({
  targetType: binding.targetType,
  enclaveId: binding.enclave?.id ?? null,
  providerId: binding.provider?.id ?? null,
  networkId: binding.network?.id ?? null
});

export let networkPolicyPreviewPresenter = (
  networkPolicy: NetworkPolicy & {
    currentVersion: NetworkPolicyVersion | null;
  }
) => ({
  object: 'network.policy#preview',

  id: networkPolicy.id,
  name: networkPolicy.name,
  version: networkPolicy.currentVersionNumber,
  rules: networkPolicyRulesPresenter(
    (networkPolicy.currentVersion?.rules ?? []) as PrismaJson.NetworkPolicyRules
  )
});

export let firewallPresenter = (
  firewall: Firewall & {
    network: { id: string };
    bindings: (FirewallBinding & {
      enclave?: { id: string } | null;
      provider?: { id: string } | null;
      network?: { id: string } | null;
    })[];
    networkPolicyLinks: (FirewallNetworkPolicy & {
      networkPolicy: NetworkPolicy & {
        currentVersion: NetworkPolicyVersion | null;
      };
    })[];
  }
) => ({
  object: 'firewall',

  id: firewall.id,
  slug: firewall.slug,
  name: firewall.name,
  description: firewall.description,
  networkId: firewall.network.id,

  bindings: firewall.bindings.map(presentFirewallBinding),
  networkPolicies: firewall.networkPolicyLinks.map(link =>
    networkPolicyPreviewPresenter(link.networkPolicy)
  ),

  createdAt: firewall.createdAt,
  updatedAt: firewall.updatedAt
});
