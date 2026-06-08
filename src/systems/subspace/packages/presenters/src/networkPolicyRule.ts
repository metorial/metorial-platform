type NetworkPolicyPortRange = PrismaJson.NetworkPolicyPortRange;
type NetworkPolicyRule = PrismaJson.NetworkPolicyRule;
type NetworkPolicyRules = PrismaJson.NetworkPolicyRules;

export let networkPolicyPortRangePresenter = (portRange: NetworkPolicyPortRange) => ({
  object: 'network.policy.port_range',

  from: portRange.from,
  to: portRange.to
});

export let networkPolicyRulePresenter = (rule: NetworkPolicyRule) => ({
  object: 'network.policy.rule',

  id: rule.id,
  effect: rule.effect,
  direction: rule.direction,
  cidrs: rule.cidrs,
  description: rule.description ?? null,
  enabled: rule.enabled,
  priority: rule.priority,
  ports: rule.ports?.map(networkPolicyPortRangePresenter) ?? null
});

export let networkPolicyRulesPresenter = (rules: NetworkPolicyRules) =>
  rules.map(networkPolicyRulePresenter);
