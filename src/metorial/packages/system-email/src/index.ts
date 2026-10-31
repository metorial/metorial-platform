import { getEmailDomain, matchesDomainSuffix } from '@lowerdeck/email-domain-check';

export let systemUserEmailDomain = 'system.metorial.net';
export let onboardingUserEmailDomain = 'onboarding.metorial.net';
export let serviceAccountEmailDomain = 'service-accounts.metorial.net';

export let internalSystemEmailDomains = [
  systemUserEmailDomain,
  'system.metorial.com',
  onboardingUserEmailDomain,
  serviceAccountEmailDomain,
  'service-accounts.metorial.invalid'
];

export let reservedExampleEmailDomains = ['example.com', 'example.net', 'example.org'];

export let nonDeliverableTopLevelDomains = ['invalid', 'local', 'internal', 'localhost'];

export let isInternalSystemEmail = (email: string) => {
  let domain = getEmailDomain(email);
  if (!domain) return false;

  return matchesDomainSuffix(domain, internalSystemEmailDomains);
};

export let isNonDeliverableEmail = (email: string) => {
  let domain = getEmailDomain(email);
  if (!domain) return false;
  if (matchesDomainSuffix(domain, internalSystemEmailDomains)) return true;
  if (matchesDomainSuffix(domain, reservedExampleEmailDomains)) return true;

  let topLevelDomain = domain.split('.').pop();
  return !!topLevelDomain && nonDeliverableTopLevelDomains.includes(topLevelDomain);
};
