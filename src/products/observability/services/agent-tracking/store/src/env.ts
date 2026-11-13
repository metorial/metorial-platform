import { defineSettings, setting } from '@metorial/settings';
import { v } from '@lowerdeck/validation';

let recordsSettings = defineSettings('records', {
  mongoUrl: setting(v.optional(v.string()), {
    env: 'AGENT_TRACKING_MONGO_URL',
    audience: 'deployment',
    secret: true,
    description: 'MongoDB (DocumentDB in production) database that stores normalized records.'
  })
});

export let env = {
  records: recordsSettings
};
