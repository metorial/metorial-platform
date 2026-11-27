import { v } from '@lowerdeck/validation';

export let networkPolicyRuleValidator = v.object({
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
  description: v.optional(
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
  ports: v.optional(
    v.array(
      v.object({
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
});
