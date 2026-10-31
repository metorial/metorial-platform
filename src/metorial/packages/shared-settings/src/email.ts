import { v } from '@lowerdeck/validation';
import { perEdition } from '@metorial/editions';
import { defineSettings, setting } from '@metorial/settings';
import { once } from './once';

type LazyDefault = string | undefined | (() => string | undefined);

export let emailName = setting(v.string(), {
  env: 'EMAIL_NAME',
  audience: 'customer',
  description: 'Display name emails are sent from',
  default: perEdition<LazyDefault>({ cloud: undefined, 'on-prem': 'Metorial' })
});

export let emailAddress = setting(v.string(), {
  env: 'EMAIL_ADDRESS',
  audience: 'customer',
  description:
    'Address emails are sent from, it has to be allowed by the SMTP server or SES identity'
});

let loadEmailTransport = once(() =>
  defineSettings('email', {
    smtpHost: setting(v.optional(v.string()), {
      env: 'EMAIL_HOST',
      audience: 'customer',
      description: 'SMTP server used to send email. Leave empty when using SES'
    }),

    smtpPort: setting(v.optional(v.number()), { env: 'EMAIL_PORT', audience: 'customer' }),

    smtpSecure: setting(v.optional(v.boolean()), {
      env: 'EMAIL_SECURE',
      audience: 'customer'
    }),

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
  })
);

export let emailTransportSettings = () => loadEmailTransport();
