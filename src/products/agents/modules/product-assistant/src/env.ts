import { defineSettings } from '@metorial/settings';
import { v } from '@lowerdeck/validation';

export let env = defineSettings({
  subspace: {
    SUBSPACE_SOLUTION: v.string()
  },

  models: {
    CLOUDFLARE_AI_API_TOKEN: v.optional(v.string()),
    CLOUDFLARE_ACCOUNT_ID: v.optional(v.string())
  },

  scout: {
    SCOUT_URL: v.optional(v.string()),
    SCOUT_TOKEN: v.optional(v.string())
  }
});
