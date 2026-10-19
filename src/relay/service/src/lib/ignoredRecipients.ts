let ignoredRecipientDomains = [
  'onboarding.metorial.net',
  'system.metorial.net',
  'service-accounts.metorial.net',
  'service-accounts.metorial.invalid'
];

let ignoredRecipientTopLevelDomains = ['invalid', 'local', 'internal', 'localhost'];

let getEmailDomain = (email: string) => {
  let domain = email.trim().toLowerCase().split('@').pop();
  if (!domain || domain == email.trim().toLowerCase()) return null;

  return domain;
};

export let isIgnoredEmailRecipient = (email: string) => {
  let domain = getEmailDomain(email);
  if (!domain) return false;

  if (
    ignoredRecipientDomains.some(
      ignoredDomain => domain == ignoredDomain || domain.endsWith(`.${ignoredDomain}`)
    )
  ) {
    return true;
  }

  let topLevelDomain = domain.split('.').pop();

  return !!topLevelDomain && ignoredRecipientTopLevelDomains.includes(topLevelDomain);
};

export let filterIgnoredEmailRecipients = (recipients: string[]) =>
  recipients.filter(recipient => !isIgnoredEmailRecipient(recipient));
