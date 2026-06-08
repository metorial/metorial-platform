import { v } from '@lowerdeck/validation';

export let firewallBindingTargetValidator = v.object({
  target_type: v.enumOf(['enclave', 'provider', 'network']),
  enclave_id: v.optional(v.string()),
  provider_id: v.optional(v.string()),
  network_id: v.optional(v.string())
});

export let networkPolicyRuleValidator = v.object({
  effect: v.enumOf(['allow', 'deny']),
  direction: v.enumOf(['ingress', 'egress']),
  cidrs: v.array(v.string()),
  description: v.optional(v.string()),
  enabled: v.boolean(),
  priority: v.number(),
  ports: v.optional(
    v.array(
      v.object({
        from: v.number(),
        to: v.number()
      })
    )
  )
});
