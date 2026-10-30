import { v } from '@lowerdeck/validation';
import { defineSettings, setting } from '@metorial/settings';
import { redisUrl } from '@metorial/shared-settings';

export let env = defineSettings({
  service: {
    REDIS_URL: redisUrl,
    DATABASE_URL: v.string(),

    RELAY_PORT: v.optional(v.number())
  }
});

export let emailSettings = defineSettings('email', {
  smtpHost: setting(v.optional(v.string()), {
    env: 'EMAIL_HOST',
    audience: 'customer',
    description: 'SMTP server used to send email. Leave empty when using SES'
  }),

  smtpPort: setting(v.optional(v.number()), { env: 'EMAIL_PORT', audience: 'customer' }),

  smtpSecure: setting(v.optional(v.boolean()), { env: 'EMAIL_SECURE', audience: 'customer' }),

  smtpUser: setting(v.optional(v.string()), { env: 'EMAIL_USER', audience: 'customer' }),

  smtpPassword: setting(v.optional(v.string()), {
    env: 'EMAIL_PASSWORD',
    audience: 'customer',
    secret: true
  }),

  sesRegion: setting(v.optional(v.string()), {
    env: 'EMAIL_SES_REGION',
    audience: 'customer',
    description: 'AWS region of SES. When set, SES is used instead of SMTP'
  }),

  sesAccessKeyId: setting(v.optional(v.string()), {
    env: 'EMAIL_SES_ACCESS_KEY_ID',
    audience: 'customer',
    description: 'Optional, the default AWS credential chain is used when empty'
  }),

  sesSecretAccessKey: setting(v.optional(v.string()), {
    env: 'EMAIL_SES_SECRET_ACCESS_KEY',
    audience: 'customer',
    secret: true
  })
});
