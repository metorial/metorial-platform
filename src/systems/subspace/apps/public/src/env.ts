import { createValidatedEnv } from '@mtsrc/env';
import { v } from '@mtsrc/validation';

export let env = createValidatedEnv({
  files: {
    TOOL_CALL_ATTACHMENT_CAMO_URL: v.optional(v.string())
  }
});
