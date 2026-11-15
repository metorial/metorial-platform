import { defineSettings } from '@metorial/settings';
import { v } from '@lowerdeck/validation';

export let env = defineSettings({
  keys: {
    AUTH_TICKET_SECRET: v.string()
  }
});
