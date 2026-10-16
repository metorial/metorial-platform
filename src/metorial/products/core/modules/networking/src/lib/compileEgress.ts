import { Hash } from '@lowerdeck/hash';
import { cidrSetSubtract, emptyCidr, universeCidr } from './cidrSet';
import { compileNetworkAllowList } from './compileNetworkAllowList';
import { getCurrentNetworkPolicyRules } from './networkPolicyRules';
import { fullPortRange } from './portRangeSet';

export type EgressRule = PrismaJson.SandboxEgressRule;
export type EgressRules = PrismaJson.SandboxEgressRules;

export let genesisEgressLimits = { maxRules: 100, maxRulesBytes: 8 * 1024 };

let blockedRanges = [
  '0.0.0.0/8',
  '10.0.0.0/8',
  '100.64.0.0/10',
  '127.0.0.0/8',
  '169.254.0.0/16',
  '172.16.0.0/12',
  '192.0.0.0/24',
  '192.0.2.0/24',
  '192.88.99.0/24',
  '192.168.0.0/16',
  '198.18.0.0/15',
  '198.51.100.0/24',
  '203.0.113.0/24',
  '224.0.0.0/4',
  '240.0.0.0/4',
  '::/96',
  'ff00::/8',
  'fe80::/10',
  'fc00::/7',
  'fec0::/10',
  '2001:db8::/32',
  '100::/64',
  '64:ff9b:1::/48'
];

export type EgressFirewallInput = {
  policies: { rules: unknown }[];
};

export type CompiledEgress = {
  rules: EgressRules;
  warnings: string[];
};

export class EgressCompileError extends Error {}

export let hashFirewallSet = (firewallIds: string[]) => Hash.sha256(firewallIds.join(','));

export let hashEgressRules = (rules: EgressRules) => Hash.sha256(JSON.stringify(rules));

let isUnreachable = (cidr: string) => cidrSetSubtract([cidr], blockedRanges).length === 0;

let denyAll = (): EgressRules => [
  { action: 'deny', protocol: 'any', cidr: universeCidr('ipv4') },
  { action: 'deny', protocol: 'any', cidr: universeCidr('ipv6') }
];

export let compileEgressRules = (d: { firewalls: EgressFirewallInput[] }): CompiledEgress => {
  if (d.firewalls.length === 0) return { rules: [], warnings: [] };

  let policyRules = d.firewalls.flatMap(firewall =>
    firewall.policies.flatMap(policy => getCurrentNetworkPolicyRules({ rules: policy.rules }))
  );
  let allowList = compileNetworkAllowList({ direction: 'egress', rules: policyRules });

  let coversEverything = [universeCidr('ipv4'), universeCidr('ipv6')].every(universe =>
    allowList.entries.some(
      entry =>
        entry.cidr === universe &&
        (!entry.portRange ||
          (entry.portRange.from === fullPortRange().from &&
            entry.portRange.to === fullPortRange().to))
    )
  );
  if (coversEverything) return { rules: [], warnings: [] };

  let warnings: string[] = [];
  let allows: EgressRules = [];
  let placeholders = [emptyCidr('ipv4'), emptyCidr('ipv6')];

  for (let entry of allowList.entries) {
    if (isUnreachable(entry.cidr)) {
      if (!placeholders.includes(entry.cidr)) {
        warnings.push(
          `Allowing ${entry.cidr} has no effect: it is inside a range sandboxes can never reach.`
        );
      }
      continue;
    }

    let fullRange =
      !entry.portRange ||
      (entry.portRange.from === fullPortRange().from &&
        entry.portRange.to === fullPortRange().to);

    allows.push({
      action: 'allow',
      protocol: 'any',
      cidr: entry.cidr,
      ...(fullRange
        ? {}
        : { ports: [entry.portRange!.from, entry.portRange!.to] as [number, number] })
    });
  }

  let rules = [...allows, ...denyAll()];

  if (rules.length > genesisEgressLimits.maxRules) {
    throw new EgressCompileError(
      `The attached firewalls compile to ${rules.length} egress rules; at most ${genesisEgressLimits.maxRules} are supported.`
    );
  }

  if (
    new TextEncoder().encode(JSON.stringify(rules)).length > genesisEgressLimits.maxRulesBytes
  ) {
    throw new EgressCompileError(
      `The attached firewalls compile to more than ${genesisEgressLimits.maxRulesBytes} bytes of egress rules.`
    );
  }

  return { rules, warnings };
};
