import { badRequestError, ServiceError } from '@lowerdeck/error';
import { isValidCIDR } from 'ipaddr.js';
import type { NetworkPolicyRuleInput } from './networkPolicyRules';

type NetworkPolicyRule = PrismaJson.NetworkPolicyRule;
type NetworkPolicyRules = PrismaJson.NetworkPolicyRules;

let throwValidationError = (message: string) => {
  throw new ServiceError(
    badRequestError({
      code: 'invalid_network_policy_rules',
      message
    })
  );
};

export let validateNetworkPolicyRuleInputs = (rules: NetworkPolicyRuleInput[]) => {
  for (let rule of rules) {
    validateNetworkPolicyRuleInput(rule);
  }

  return rules;
};

export let validateNetworkPolicyRuleInput = (rule: NetworkPolicyRuleInput) => {
  validateNetworkPolicyRuleShape(rule);
};

export let validateNetworkPolicyRules = (rules: NetworkPolicyRules) => {
  let ruleIds = new Set<string>();

  for (let rule of rules) {
    validateStoredNetworkPolicyRule(rule, ruleIds);
  }

  return rules;
};

let validateStoredNetworkPolicyRule = (rule: NetworkPolicyRule, ruleIds: Set<string>) => {
  if (!rule.id?.trim()) {
    throwValidationError('Each network policy rule must have a non-empty id.');
  }

  if (ruleIds.has(rule.id)) {
    throwValidationError(`Duplicate network policy rule id "${rule.id}".`);
  }
  ruleIds.add(rule.id);

  validateNetworkPolicyRuleShape(rule, rule.id);
};

let validateNetworkPolicyRuleShape = (
  rule: NetworkPolicyRuleInput | NetworkPolicyRule,
  ruleId?: string
) => {
  let label = ruleId ? `Rule "${ruleId}"` : 'Network policy rule';

  if (rule.effect !== 'allow' && rule.effect !== 'deny') {
    throwValidationError(`${label} must have effect "allow" or "deny".`);
  }

  if (rule.direction !== 'ingress' && rule.direction !== 'egress') {
    throwValidationError(`${label} must have direction "ingress" or "egress".`);
  }

  if (!Array.isArray(rule.cidrs) || rule.cidrs.length === 0) {
    throwValidationError(`${label} must include at least one CIDR.`);
  }

  for (let cidr of rule.cidrs) {
    if (!isValidCIDR(cidr)) {
      throwValidationError(`${label} includes invalid CIDR "${cidr}".`);
    }
  }

  if (!Number.isInteger(rule.priority)) {
    throwValidationError(`${label} must have an integer priority.`);
  }

  if (typeof rule.enabled !== 'boolean') {
    throwValidationError(`${label} must have enabled set to true or false.`);
  }

  if (rule.ports !== undefined) {
    if (rule.direction !== 'egress') {
      throwValidationError(`${label} may only include ports on egress rules.`);
    }

    if (!Array.isArray(rule.ports) || rule.ports.length === 0) {
      throwValidationError(
        `${label} must include at least one port range when ports are set.`
      );
    }

    for (let portRange of rule.ports) {
      validatePortRange(label, portRange);
    }
  }
};

let validatePortRange = (label: string, portRange: { from: number; to: number }) => {
  if (
    !Number.isInteger(portRange.from) ||
    !Number.isInteger(portRange.to) ||
    portRange.from < 1 ||
    portRange.to > 65535 ||
    portRange.from > portRange.to
  ) {
    throwValidationError(
      `${label} includes an invalid port range. Ports must be integers from 1 to 65535 with from <= to.`
    );
  }
};
