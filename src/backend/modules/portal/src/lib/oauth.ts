import { badRequestError, ServiceError } from '@lowerdeck/error';

export let urlsMatch = (url1: string, url2: string) => {
  try {
    let u1 = new URL(url1);
    let u2 = new URL(url2);

    return (
      u1.protocol == u2.protocol &&
      u1.hostname == u2.hostname &&
      u1.port == u2.port &&
      u1.pathname == u2.pathname
    );
  } catch {
    return false;
  }
};

export let validateUrlString = (value: string, field: string) => {
  try {
    new URL(value);
  } catch {
    throw new ServiceError(
      badRequestError({
        message: `${field} must be a valid URL`,
        oauth: {
          error: 'invalid_request',
          errorMessage: `${field} must be a valid URL`
        }
      })
    );
  }
};

export let validateRedirectUri = (redirectUri: string, allowedRedirectUris: string[]) => {
  validateUrlString(redirectUri, 'redirect_uri');

  if (!allowedRedirectUris.some(allowedUri => urlsMatch(allowedUri, redirectUri))) {
    throw new ServiceError(
      badRequestError({
        message: 'Invalid redirect URI',
        oauth: {
          error: 'invalid_request',
          errorMessage: 'Invalid redirect URI'
        }
      })
    );
  }
};

export let base64UrlEncode = (input: Uint8Array) =>
  Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');

export let createCodeChallenge = async (codeVerifier: string) => {
  let digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(codeVerifier));
  return base64UrlEncode(new Uint8Array(digest));
};
