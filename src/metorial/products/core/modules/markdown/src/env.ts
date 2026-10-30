import { v } from '@lowerdeck/validation';
import { perEdition } from '@metorial/editions';
import { defineSettings, setting } from '@metorial/settings';

export let env = defineSettings({
  links: {
    MARKDOWN_FIRST_PARTY_DOMAINS: setting.list(v.string(), {
      default: perEdition({ cloud: ['metorial.com'], 'on-prem': [] })
    })
  }
});
