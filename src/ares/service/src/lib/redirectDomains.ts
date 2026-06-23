import { badRequestError, ServiceError } from '@lowerdeck/error';

let invalidRedirectDomainError = () =>
  new ServiceError(
    badRequestError({
      message:
        'Invalid redirect domain. Use a hostname like example.com or a wildcard like *.example.com'
    })
  );

export let normalizeRedirectDomain = (domain: string) => {
  let normalized = domain.trim().toLowerCase();
  if (!normalized) {
    throw invalidRedirectDomainError();
  }

  let isWildcard = normalized.startsWith('*.');
  let hostname = isWildcard ? normalized.slice(2) : normalized;

  if (!hostname || hostname.includes('*')) {
    throw invalidRedirectDomainError();
  }

  if (hostname.endsWith('.')) {
    hostname = hostname.slice(0, -1);
  }

  if (!hostname) {
    throw invalidRedirectDomainError();
  }

  let parsed: URL;
  try {
    parsed = new URL(`https://${hostname}`);
  } catch {
    throw invalidRedirectDomainError();
  }

  if (
    parsed.hostname !== hostname ||
    parsed.username ||
    parsed.password ||
    parsed.port ||
    parsed.pathname !== '/' ||
    parsed.search ||
    parsed.hash
  ) {
    throw invalidRedirectDomainError();
  }

  if (isWildcard && !hostname.includes('.')) {
    throw invalidRedirectDomainError();
  }

  return isWildcard ? `*.${hostname}` : hostname;
};

export let normalizeRedirectDomains = (domains: string[]) => {
  return [...new Set(domains.map(normalizeRedirectDomain))];
};

export let isRedirectDomainMatch = (hostname: string, redirectDomain: string) => {
  let normalizedHostname = hostname.trim().toLowerCase();
  let normalizedRedirectDomain = normalizeRedirectDomain(redirectDomain);

  if (normalizedRedirectDomain.startsWith('*.')) {
    let suffix = normalizedRedirectDomain.slice(1);
    return (
      normalizedHostname.endsWith(suffix) && normalizedHostname.length > suffix.length
    );
  }

  return normalizedHostname === normalizedRedirectDomain;
};
