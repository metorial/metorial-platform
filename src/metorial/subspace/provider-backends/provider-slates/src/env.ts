import { createValidatedEnv } from '@lowerdeck/env';
import { v } from '@lowerdeck/validation';

export let env = createValidatedEnv({
  service: {
    REDIS_URL: v.string(),

    SLATES_HUB_URL: v.string(),
    SLATES_HUB_PUBLIC_URL: v.string(),

    REGISTRY_URL: v.optional(v.string())
  }
});
