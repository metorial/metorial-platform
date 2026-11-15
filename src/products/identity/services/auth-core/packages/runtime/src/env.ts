import { defineSettings } from '@metorial/settings';
import { v } from '@lowerdeck/validation';

export let env = defineSettings({
  service: {
    ARES_AUTH_PORT: v.optional(v.number()),
    ARES_ADMIN_PORT: v.optional(v.number()),
    ARES_SSO_PORT: v.optional(v.number()),
    ARES_INTERNAL_PORT: v.optional(v.number())
  }
});
