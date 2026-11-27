import { badRequestError, ServiceError } from '@lowerdeck/error';

export let setupSessionRedirectUrlPattern = /^https?:\/\//i;

export let isSetupSessionRedirectUrl = (value: string) => {
  if (!setupSessionRedirectUrlPattern.test(value)) return false;

  try {
    new URL(value);

    return true;
  } catch {
    return false;
  }
};

export let assertSetupSessionRedirectUrl = (redirectUrl: string | null | undefined) => {
  if (redirectUrl == null || isSetupSessionRedirectUrl(redirectUrl)) return;

  throw new ServiceError(
    badRequestError({
      message: 'The redirect URL must be an absolute http or https URL',
      code: 'invalid_redirect_url'
    })
  );
};
