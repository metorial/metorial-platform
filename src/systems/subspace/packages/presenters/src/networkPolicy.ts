import type {
  FirewallNetworkPolicy,
  NetworkPolicy,
  NetworkPolicyVersion
} from '@metorial-subspace/db';
import { networkPolicyRulesPresenter } from './networkPolicyRule';

export let networkPolicyVersionPresenter = (version: NetworkPolicyVersion) => ({
  object: 'network.policy_version',

  id: version.id,
  version: version.version,
  rules: networkPolicyRulesPresenter(version.rules as PrismaJson.NetworkPolicyRules),

  createdAt: version.createdAt
});

export let networkPolicyPresenter = (
  networkPolicy: NetworkPolicy & {
    currentVersion: NetworkPolicyVersion | null;
    firewallLinks?: (FirewallNetworkPolicy & {
      firewall: { id: string };
    })[];
  }
) => ({
  object: 'network.policy',

  id: networkPolicy.id,
  name: networkPolicy.name,
  description: networkPolicy.description,
  status: networkPolicy.status,
  version: networkPolicy.currentVersionNumber,
  rules: networkPolicyRulesPresenter(
    (networkPolicy.currentVersion?.rules ?? []) as PrismaJson.NetworkPolicyRules
  ),
  firewallIds: networkPolicy.firewallLinks?.map(link => link.firewall.id),

  createdAt: networkPolicy.createdAt,
  updatedAt: networkPolicy.updatedAt,
  archivedAt: networkPolicy.archivedAt
});
