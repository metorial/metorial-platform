import { defineSettings, setting } from '@metorial/settings';
import { v } from '@lowerdeck/validation';

export let env = defineSettings({
  service: {
    ARES_AUTH_URL: v.string(),
    ARES_ADMIN_URL: setting(v.string(), { requiredIn: ['cloud'] }),
    ARES_SSO_URL: v.string()
  },

  sso: {
    SAML_AUDIENCE: v.string()
  }
});
