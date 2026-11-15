import { defineSettings } from '@metorial/settings';
import { emailAddress, emailName, redisUrl, serviceUrl } from '@metorial/shared-settings';

export let env = defineSettings({
  service: {
    REDIS_URL: redisUrl,
    RELAY_URL: serviceUrl('relay')
  },

  email: {
    EMAIL_NAME: emailName,
    EMAIL_ADDRESS: emailAddress
  }
});
