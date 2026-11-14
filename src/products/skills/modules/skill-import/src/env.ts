import { defineSettings } from '@metorial/settings';
import { v } from '@lowerdeck/validation';

export let env = defineSettings({
  origin: {
    CODE_BUCKET_SERVICE_URL: v.string()
  }
});
