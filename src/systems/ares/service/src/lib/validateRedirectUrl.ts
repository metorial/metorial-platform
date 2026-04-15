import { badRequestError, ServiceError } from '@lowerdeck/error';
import { isRedirectDomainMatch } from './redirectDomains';

export let validateRedirectUrl = (redirectUrl: string, redirectDomains: string[]) => {
  if (redirectDomains.length === 0) return;

  let url: URL;
  try {
    url = new URL(redirectUrl);
  } catch {
    throw new ServiceError(badRequestError({ message: 'Invalid redirect URL' }));
  }

  let hostname = url.hostname;

  for (let redirectDomain of redirectDomains) {
    if (isRedirectDomainMatch(hostname, redirectDomain)) return;
  }

  throw new ServiceError(badRequestError({ message: 'Redirect URL domain not allowed' }));
};
