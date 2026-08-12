import { createValidatedEnv } from '@lowerdeck/env';
import { v } from '@lowerdeck/validation';

export let env = createValidatedEnv({
  files: {
    TOOL_CALL_ATTACHMENT_CAMO_URL: v.optional(v.string())
  },
  service: {
    INTEGRATIONS_API_URL: v.string(),
    INTEGRATIONS_UI_URL: v.string(),
    CORS_DOMAINS: v.optional(v.string()),
    ALLOW_CORS: v.optional(v.string())
  }
});
