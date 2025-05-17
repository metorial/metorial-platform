import { getConfig } from '@metorial/config';
import { ensureEmailIdentity } from '@metorial/db';

export let defaultEmailIdentity = ensureEmailIdentity(async () => ({
  type: 'email',
  slug: 'default',
  fromEmail: getConfig().email.fromEmail,
  fromName: getConfig().email.fromName
}));
