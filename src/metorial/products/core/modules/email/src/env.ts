import { defineSettings } from '@metorial/settings';
import { emailAddress, emailName, serviceUrl } from '@metorial/shared-settings';
import { v } from '@lowerdeck/validation';

export let env = defineSettings({
  service: {
    REDIS_URL: v.optional(v.string()),
    DATABASE_URL: v.string(),
    RELAY_URL: serviceUrl('relay')
  },

  email: {
    EMAIL_NAME: emailName,
    EMAIL_ADDRESS: emailAddress
  }
});
