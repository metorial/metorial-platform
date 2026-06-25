import type {
  Firewall,
  FirewallNetworkPolicy,
  NetworkPolicy,
  NetworkPolicyVersion
} from '@metorial-subspace/db';
import { networkPolicyRulesPresenter } from './networkPolicyRule';

export let firewallPreviewPresenter = (firewall: Pick<Firewall, 'id' | 'slug' | 'name'>) => ({
  object: 'firewall#preview',

  id: firewall.id,
  slug: firewall.slug,
  name: firewall.name
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
  status: firewall.status,
  networkId: firewall.network.id,

  networkPolicies: firewall.networkPolicyLinks.map(link =>
    networkPolicyPreviewPresenter(link.networkPolicy)
  ),

  createdAt: firewall.createdAt,
  updatedAt: firewall.updatedAt,
  archivedAt: firewall.archivedAt
});
