import { getId } from '@metorial-subspace/db';
import {
  validateNetworkPolicyRuleInput,
  validateNetworkPolicyRuleInputs,
  validateNetworkPolicyRules
} from './networkPolicyValidation';

type NetworkPolicyPortRange = PrismaJson.NetworkPolicyPortRange;
type NetworkPolicyRule = PrismaJson.NetworkPolicyRule;
type NetworkPolicyRules = PrismaJson.NetworkPolicyRules;

export type NetworkPolicyRuleInput = {
  effect: NetworkPolicyRule['effect'];
  direction: NetworkPolicyRule['direction'];
  cidrs: string[];
  description?: string;
  enabled: boolean;
  priority: number;
  ports?: NetworkPolicyPortRange[];
};

let normalizePorts = (ports?: NetworkPolicyPortRange[]) => {
  if (!ports) return undefined;

  return [...ports].sort((a, b) => a.from - b.from || a.to - b.to);
};

let normalizeRuleContent = (rule: NetworkPolicyRuleInput | NetworkPolicyRule) => ({
  effect: rule.effect,
  direction: rule.direction,
  cidrs: [...rule.cidrs].sort(),
  description: rule.description?.trim() || undefined,
  enabled: rule.enabled,
  priority: rule.priority,
  ports: normalizePorts(rule.ports)
});

export let rulesContentEqual = (
  a: NetworkPolicyRuleInput | NetworkPolicyRule,
  b: NetworkPolicyRuleInput | NetworkPolicyRule
) => JSON.stringify(normalizeRuleContent(a)) === JSON.stringify(normalizeRuleContent(b));

export let normalizeNetworkPolicyRuleInput = (
  rule: NetworkPolicyRuleInput
): Omit<NetworkPolicyRule, 'id'> => {
  validateNetworkPolicyRuleInput(rule);

  return {
    effect: rule.effect,
    direction: rule.direction,
    cidrs: rule.cidrs,
    description: rule.description?.trim() || undefined,
    enabled: rule.enabled,
    priority: rule.priority,
    ports: rule.ports
  };
};

export let createNetworkPolicyRule = (rule: NetworkPolicyRuleInput): NetworkPolicyRule => ({
  ...normalizeNetworkPolicyRuleInput(rule),
  id: getId('networkPolicyRule').id
});

export let assignNetworkPolicyRuleIds = (
  input: NetworkPolicyRuleInput[],
  current: NetworkPolicyRules = []
): NetworkPolicyRules => {
  validateNetworkPolicyRuleInputs(input);

  let usedCurrentIds = new Set<string>();

  let rules = input.map(ruleInput => {
    let match = current.find(
      rule => !usedCurrentIds.has(rule.id) && rulesContentEqual(rule, ruleInput)
    );
    if (match) {
      usedCurrentIds.add(match.id);
      return {
        ...normalizeNetworkPolicyRuleInput(ruleInput),
        id: match.id
      };
    }

    return createNetworkPolicyRule(ruleInput);
  });

  return validateNetworkPolicyRules(rules);
};

export let getCurrentNetworkPolicyRules = (
  currentVersion: { rules: unknown } | null | undefined
): NetworkPolicyRules => {
  if (!currentVersion?.rules || !Array.isArray(currentVersion.rules)) return [];

  return validateNetworkPolicyRules(currentVersion.rules as NetworkPolicyRules);
};

export let networkPolicyRulesEqual = (a: NetworkPolicyRules, b: NetworkPolicyRules) =>
  a.length === b.length &&
  a.every((rule, index) => rule.id === b[index]?.id && rulesContentEqual(rule, b[index]!));
