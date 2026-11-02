import { defineSettings } from '@metorial/settings';
import { v } from '@lowerdeck/validation';

export let env = defineSettings({
  subspace: {
    SUBSPACE_SOLUTION: v.string()
  },

  scout: {
    SCOUT_URL: v.optional(v.string()),
    SCOUT_TOKEN: v.optional(v.string())
  }
});
