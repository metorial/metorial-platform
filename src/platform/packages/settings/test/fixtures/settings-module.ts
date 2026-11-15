import { v } from '@lowerdeck/validation';
import { perEdition } from '@metorial/editions';
import { defineSettings, setting } from '../../src';

export let fixtureSettings = defineSettings('links', {
  publicUrl: setting(v.string({ modifiers: [v.url()] }), {
    env: 'FIXTURE_PUBLIC_URL',
    audience: 'customer',
    description: 'Public URL of the installation'
  }),

  trustedDomains: setting.list(v.string(), {
    env: 'FIXTURE_TRUSTED_DOMAINS',
    audience: 'customer',
    default: perEdition({ cloud: ['metorial.com'], 'on-prem': [] })
  }),

  apiUrl: setting(v.string(), {
    env: 'FIXTURE_API_URL',
    audience: 'derived',
    default: () => `${process.env.FIXTURE_PUBLIC_URL}/api`
  }),

  internalUrl: setting(v.string(), { env: 'FIXTURE_INTERNAL_URL' }),

  token: setting(v.string(), {
    env: 'FIXTURE_TOKEN',
    audience: 'deployment',
    secret: true,
    default: 'generated'
  })
});
