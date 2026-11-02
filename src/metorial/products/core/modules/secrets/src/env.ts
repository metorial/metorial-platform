import { defineSettings } from '@metorial/settings';
import { serviceUrl } from '@metorial/shared-settings';
import { v } from '@lowerdeck/validation';

export let env = defineSettings({
  service: {
    NEBULA_API_URL: serviceUrl('nebula')
  }
});
