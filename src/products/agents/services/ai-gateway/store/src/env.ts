import { v } from '@lowerdeck/validation';
import { defineSettings, setting } from '@metorial/settings';

let storeSettings = defineSettings('store', {
  mongoUrl: setting(v.optional(v.string()), {
    env: 'AI_GATEWAY_MONGO_URL',
    audience: 'deployment',
    secret: true,
    description:
      'MongoDB (DocumentDB in production) database that stores inference logs, logged content and connection checks.'
  })
});

export let env = {
  store: storeSettings
};
