import { badRequestError, ServiceError } from '@lowerdeck/error';
import { isValidCIDR } from 'ipaddr.js';

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

export let validateNetworkPolicyRules = (rules: NetworkPolicyRules) => {
  if (!Array.isArray(rules) || rules.length === 0) {
    throwValidationError('Network policy must include at least one rule.');
  }

  let ruleIds = new Set<string>();

  for (let rule of rules) {
    validateNetworkPolicyRule(rule, ruleIds);
  }

  return rules;
};

let validateNetworkPolicyRule = (rule: NetworkPolicyRule, ruleIds: Set<string>) => {
  if (!rule.id?.trim()) {
    throwValidationError('Each network policy rule must have a non-empty id.');
  }

  if (ruleIds.has(rule.id)) {
    throwValidationError(`Duplicate network policy rule id "${rule.id}".`);
  }
  ruleIds.add(rule.id);

  if (rule.effect !== 'allow' && rule.effect !== 'deny') {
    throwValidationError(`Rule "${rule.id}" must have effect "allow" or "deny".`);
  }

  if (rule.direction !== 'ingress' && rule.direction !== 'egress') {
    throwValidationError(`Rule "${rule.id}" must have direction "ingress" or "egress".`);
  }

  if (!Array.isArray(rule.cidrs) || rule.cidrs.length === 0) {
    throwValidationError(`Rule "${rule.id}" must include at least one CIDR.`);
  }

  for (let cidr of rule.cidrs) {
    if (!isValidCIDR(cidr)) {
      throwValidationError(`Rule "${rule.id}" includes invalid CIDR "${cidr}".`);
    }
  }

  if (!Number.isInteger(rule.priority)) {
    throwValidationError(`Rule "${rule.id}" must have an integer priority.`);
  }

  if (typeof rule.enabled !== 'boolean') {
    throwValidationError(`Rule "${rule.id}" must have enabled set to true or false.`);
  }

  if (rule.ports !== undefined) {
    if (rule.direction !== 'egress') {
      throwValidationError(`Rule "${rule.id}" may only include ports on egress rules.`);
    }

    if (!Array.isArray(rule.ports) || rule.ports.length === 0) {
      throwValidationError(`Rule "${rule.id}" must include at least one port range when ports are set.`);
    }

    for (let portRange of rule.ports) {
      validatePortRange(rule.id, portRange);
    }
  }
};

let validatePortRange = (ruleId: string, portRange: { from: number; to: number }) => {
  if (
    !Number.isInteger(portRange.from) ||
    !Number.isInteger(portRange.to) ||
    portRange.from < 1 ||
    portRange.to > 65535 ||
    portRange.from > portRange.to
  ) {
    throwValidationError(
      `Rule "${ruleId}" includes an invalid port range. Ports must be integers from 1 to 65535 with from <= to.`
    );
  }
};
