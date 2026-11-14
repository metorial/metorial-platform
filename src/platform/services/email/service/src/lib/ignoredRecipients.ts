import { isNonDeliverableEmail } from '@metorial/system-email';

export let isIgnoredEmailRecipient = (email: string) => isNonDeliverableEmail(email);

export let filterIgnoredEmailRecipients = (recipients: string[]) =>
  recipients.filter(recipient => !isIgnoredEmailRecipient(recipient));
