import { badRequestError, ServiceError } from '@lowerdeck/error';
import { validateRedirectUrl } from './validateRedirectUrl';

interface RedirectApp {
  mode: 'standard' | 'horizon';
  defaultRedirectUrl: string;
  redirectDomains: string[];
}

export let wrapHorizonRedirectUrl = (d: {
  defaultRedirectUrl: string;
  redirectUrl: string;
}) => {
  let wrapper: URL;
  try {
    wrapper = new URL(d.defaultRedirectUrl);
  } catch {
    throw new ServiceError(
      badRequestError({ message: 'Horizon app has an invalid default redirect URL' })
    );
  }

  let target: URL;
  try {
    target = new URL(d.redirectUrl);
  } catch {
    throw new ServiceError(badRequestError({ message: 'Invalid redirect URL' }));
  }

  if (target.origin === wrapper.origin) return d.redirectUrl;

  wrapper.searchParams.set('redirect_url', d.redirectUrl);

  return wrapper.toString();
};

export let resolveAppRedirectUrl = (d: { app: RedirectApp; redirectUrl: string }) => {
  validateRedirectUrl(d.redirectUrl, d.app.redirectDomains);

  if (d.app.mode !== 'horizon') return d.redirectUrl;

  if (d.app.redirectDomains.length === 0) {
    throw new ServiceError(
      badRequestError({ message: 'Horizon app must declare allowed redirect domains' })
    );
  }

  return wrapHorizonRedirectUrl({
    defaultRedirectUrl: d.app.defaultRedirectUrl,
    redirectUrl: d.redirectUrl
  });
};
