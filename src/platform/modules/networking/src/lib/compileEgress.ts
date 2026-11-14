import { Hash } from '@lowerdeck/hash';
import { emptyCidr, universeCidr } from '@lowerdeck/ip-range';
import { compileNetworkAllowList } from './compileNetworkAllowList';
import { isInsideInternalRanges } from './internalRanges';
import { getCurrentNetworkPolicyRules } from './networkPolicyRules';
import { fullPortRange } from './portRangeSet';

export type EgressRule = PrismaJson.SandboxEgressRule;
export type EgressRules = PrismaJson.SandboxEgressRules;

export let genesisEgressLimits = { maxRules: 100, maxRulesBytes: 8 * 1024 };

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
    if (isInsideInternalRanges(entry.cidr)) {
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
