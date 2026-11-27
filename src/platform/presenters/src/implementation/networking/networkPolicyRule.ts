import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { networkPolicyRuleType } from '../../types';

export let networkPolicyRuleSchema = v.object(
  {
    object: v.literal('networking.network_policy.rule', {
      description: 'String representing the object’s type.'
    }),
    id: v.string({
      description: 'Unique ID.'
    }),
    effect: v.enumOf(['allow', 'deny'], {
      description: '`allow` permits matching traffic. `deny` blocks it.'
    }),
    direction: v.enumOf(['ingress', 'egress'], {
      description: '`ingress` matches incoming traffic. `egress` matches outgoing traffic.'
    }),
    cidrs: v.array(
      v.string({
        description: 'CIDR range the rule matches, for example `10.0.0.0/8`.'
      }),
      {
        description: 'CIDR ranges the rule matches.'
      }
    ),
    description: v.nullable(
      v.string({
        description: 'Free-text description.'
      })
    ),
    enabled: v.boolean({
      description: 'Whether the rule is enforced. Disabled rules are kept but ignored.'
    }),
    priority: v.number({
      description: 'Priority of the rule. Higher values are evaluated first.'
    }),
    ports: v.nullable(
      v.array(
        v.object({
          object: v.literal('networking.network_policy.port_range', {
            description: 'String representing the object’s type.'
          }),
          from: v.number({
            description: 'First port in the range, inclusive.'
          }),
          to: v.number({
            description: 'Last port in the range, inclusive.'
          })
        }),
        {
          description: 'Port ranges the rule matches. Omitted matches all ports.'
        }
      )
    )
  },
  {
    description: 'Rule in the network policy.'
  }
);

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
