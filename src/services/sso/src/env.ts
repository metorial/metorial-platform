import { createValidatedEnv } from '@metorial/env';
import { v } from '@metorial/validation';

export let env = createValidatedEnv({
  saml: {
    SSO_SERVICE_HOST: v.string(),
    SAML_AUDIENCE: v.string()
  },

  jackson: {
    SSO_MONGO_URL: v.string()
  }
});
