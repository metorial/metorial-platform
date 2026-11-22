import { isValidAccountDomain, normalizeAccountDomain } from './accountPolicy';

export type RegisteredDomainDenialReason = 'invalid_domain' | 'domain_not_registered';

export let normalizeRegisteredDomains = (domains: string[]) => {
  let normalized = [...new Set(domains.map(normalizeAccountDomain))];

  if (normalized.some(domain => !isValidAccountDomain(domain))) {
    throw new Error('Registered domains must be valid hostnames');
  }

  return normalized.sort();
};

export let evaluateRegisteredDomainSignup = (d: {
  domain: string;
  userExists: boolean;
  registeredDomains: string[];
}): { allowed: true } | { allowed: false; reason: RegisteredDomainDenialReason } => {
  if (d.userExists) return { allowed: true };

  let domain = normalizeAccountDomain(d.domain);
  if (!isValidAccountDomain(domain)) return { allowed: false, reason: 'invalid_domain' };

  if (!d.registeredDomains.includes(domain)) {
    return { allowed: false, reason: 'domain_not_registered' };
  }

  return { allowed: true };
};
