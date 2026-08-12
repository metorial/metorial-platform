import { createValidatedEnv } from '@lowerdeck/env';
import { v } from '@lowerdeck/validation';

export let env = createValidatedEnv({
  service: {
    INTEGRATIONS_API_URL: v.string(),
    INTEGRATIONS_UI_URL: v.string()
  }
});
