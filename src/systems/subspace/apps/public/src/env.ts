import { createValidatedEnv } from '@lowerdeck/env';
import { v } from '@lowerdeck/validation';

export let env = createValidatedEnv({
  files: {
    TOOL_CALL_ATTACHMENT_CAMO_URL: v.string()
  }
});
