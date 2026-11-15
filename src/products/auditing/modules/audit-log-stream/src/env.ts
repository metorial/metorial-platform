import { defineSettings } from '@metorial/settings';
import { v } from '@lowerdeck/validation';

export let env = defineSettings({
  secrets: {
    ENCRYPTION_SECRET: v.string()
  }
});
