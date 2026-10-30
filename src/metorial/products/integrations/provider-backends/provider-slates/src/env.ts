import { v } from '@lowerdeck/validation';
import { perEdition } from '@metorial/editions';
import { defineSettings, setting } from '@metorial/settings';

export let env = defineSettings({
  service: {
    REDIS_URL: v.string(),

    SLATES_HUB_URL: v.string(),
    SLATES_HUB_PUBLIC_URL: v.string(),

    REGISTRY_URL: v.optional(v.string()),

    SLATES_FIRST_PARTY_DOMAINS: setting.list(v.string(), {
      default: perEdition({
        cloud: [
          '.slates.dev',
          '.metorial.com',
          '.metorial.dev',
          '.metorial.net',
          '.metorial.app',
          '.metorial.cloud',
          '.metorial.io',
          '.metorial.ai',
          '.metorial-enterprise.com',
          'localhost'
        ],
        'on-prem': ['localhost']
      })
    })
  }
});
