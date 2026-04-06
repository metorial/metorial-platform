import { createValidatedEnv } from '@lowerdeck/env';
import { v } from '@lowerdeck/validation';

export let env = createValidatedEnv({
  portal: {
    PORTAL_HOST_TEMPLATE: v.string(),
    PORTAL_REDIRECT_DOMAINS: v.string()
  }
});
