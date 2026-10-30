import { v } from '@lowerdeck/validation';
import { perEdition } from '@metorial/editions';
import { setting } from '@metorial/settings';

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
