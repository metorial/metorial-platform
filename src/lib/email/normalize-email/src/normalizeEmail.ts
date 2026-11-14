export let normalizeEmail = (email: string) => {
  email = email.toLowerCase().trim();

  let [local, domain] = email.split('@');

  if (domain === 'googlemail.com') domain = 'gmail.com';

  if (domain == 'gmail.com') {
    // gmail ignores dots in email addresses: https://gmail.googleblog.com/2008/03/2-hidden-ways-to-get-more-from-your.html
    local = local.replaceAll('.', '');
  }

  local = local.split('+')[0];

  return `${local}@${domain}`;
};
