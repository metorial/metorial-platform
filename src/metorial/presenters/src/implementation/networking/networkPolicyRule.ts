import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { networkPolicyRuleType } from '../../types';

export let networkPolicyRuleSchema = v.object({
  object: v.literal('networking.network_policy.rule'),
  id: v.string(),
  effect: v.enumOf(['allow', 'deny']),
  direction: v.enumOf(['ingress', 'egress']),
  cidrs: v.array(v.string()),
  description: v.nullable(v.string()),
  enabled: v.boolean(),
  priority: v.number(),
  ports: v.nullable(
    v.array(
      v.object({
        object: v.literal('networking.network_policy.port_range'),
        from: v.number(),
        to: v.number()
      })
    )
  )
});

export let presentNetworkPolicyRule = (rule: PrismaJson.NetworkPolicyRule) => ({
  object: 'networking.network_policy.rule' as const,
  id: rule.id,
  effect: rule.effect,
  direction: rule.direction,
  cidrs: rule.cidrs,
  description: rule.description ?? null,
  enabled: rule.enabled,
  priority: rule.priority,
  ports:
    rule.ports?.map(port => ({
      object: 'networking.network_policy.port_range' as const,
      from: port.from,
      to: port.to
    })) ?? null
});

export let v1NetworkPolicyRulePresenter = Presenter.create(networkPolicyRuleType)
  .presenter(async ({ rule }) => presentNetworkPolicyRule(rule))
  .schema(networkPolicyRuleSchema)
  .build();
