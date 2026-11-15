import { defineSettings } from '@metorial/settings';
import { v } from '@lowerdeck/validation';

export let env = defineSettings({
  service: {
    ARES_SSO_URL: v.string()
  },

  sso: {
    SAML_AUDIENCE: v.string()
  }
});
