import { v } from '@lowerdeck/validation';

export let firewallAssignmentTargetValidator = v.object({
  target_type: v.enumOf(['enclave', 'provider', 'internet_gateway']),
  enclave_id: v.optional(v.string()),
  provider_id: v.optional(v.string())
});
