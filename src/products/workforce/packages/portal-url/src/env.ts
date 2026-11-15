import { defineSettings } from '@metorial/settings';
import { v } from '@lowerdeck/validation';

export let env = defineSettings({
  portal: {
    PORTAL_HOST_TEMPLATE: v.string(),
    PORTAL_REDIRECT_DOMAINS: v.string()
  }
});
