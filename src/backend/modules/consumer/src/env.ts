import { createValidatedEnv } from '@mtsrc/env';
import { v } from '@mtsrc/validation';

export let env = createValidatedEnv({
  portal: {
    PORTAL_HOST_TEMPLATE: v.string(),
    PORTAL_REDIRECT_DOMAINS: v.string()
  }
});
