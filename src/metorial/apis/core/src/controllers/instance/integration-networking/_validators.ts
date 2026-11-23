import { v } from '@lowerdeck/validation';

export let firewallAssignmentTargetValidator = v.object({
  target_type: v.enumOf(['enclave', 'provider', 'internet_gateway'], {
    description: 'What the firewall applies to.'
  }),
  enclave_id: v.optional(
    v.string({
      description:
        'Enclave to apply the firewall to. Required when `target_type` is `enclave`.'
    })
  ),
  provider_id: v.optional(
    v.string({
      description:
        'Provider to apply the firewall to. Required when `target_type` is `provider`.'
    })
  )
});
