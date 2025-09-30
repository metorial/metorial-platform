import { createValidatedEnv } from '@metorial/env';
import { v } from '@metorial/validation';

export let env = createValidatedEnv({
  ticket: {
    PROVIDER_OAUTH_TICKET_SECRET: v.string(),
    PROVIDER_OAUTH_URL: v.string()
  }
});
