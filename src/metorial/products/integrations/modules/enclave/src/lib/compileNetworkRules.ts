import { getCurrentNetworkPolicyRules } from '@metorial/module-networking/src/lib/networkPolicyRules';

type NetworkPolicyRules = PrismaJson.NetworkPolicyRules;

export type FirewallWithNetworkPolicies = {
  oid: bigint;
  internetGatewayOid: bigint;
  networkPolicyLinks: {
    position: number;
    networkPolicy: {
      currentVersion: { rules: unknown } | null;
    };
  }[];
};

export let dedupeFirewallsByOid = <T extends { oid: bigint }>(firewalls: T[]) => {
  let seen = new Set<bigint>();
  let result: T[] = [];

  for (let firewall of firewalls) {
    if (seen.has(firewall.oid)) continue;
    seen.add(firewall.oid);
    result.push(firewall);
  }

  return result;
};

export let compileNetworkRulesFromFirewalls = (
  firewalls: FirewallWithNetworkPolicies[]
): NetworkPolicyRules => {
  let rules: NetworkPolicyRules = [];

  for (let firewall of firewalls) {
    let links = [...firewall.networkPolicyLinks].sort((a, b) => a.position - b.position);

    for (let link of links) {
      rules.push(...getCurrentNetworkPolicyRules(link.networkPolicy.currentVersion));
    }
  }

  return rules;
};

export let compileNetworkRulesForEnclave = (d: {
  enclaveInternetGatewayOid: bigint;
  firewalls: FirewallWithNetworkPolicies[];
}) =>
  compileNetworkRulesFromFirewalls(
    dedupeFirewallsByOid(
      d.firewalls.filter(
        firewall => firewall.internetGatewayOid === d.enclaveInternetGatewayOid
      )
    )
  );
