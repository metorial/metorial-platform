import { badRequestError, isServiceError, ServiceError } from '@lowerdeck/error';

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
  } catch (e) {
    return false;
  }
};

export let validateRedirectUri = (d: {
  redirectUri: string;
  allowedRedirectUris: string[];
}) => {
  if (!d.allowedRedirectUris.some(allowedUri => urlsMatch(allowedUri, d.redirectUri))) {
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

let isLoopbackHost = (hostname: string) =>
  hostname == 'localhost' ||
  hostname == '127.0.0.1' ||
  hostname == '::1' ||
  hostname == '[::1]';

export let validateUri = (uri: string) => {
  try {
    let url = new URL(uri);

    if (
      url.protocol != 'https:' &&
      !(url.protocol == 'http:' && isLoopbackHost(url.hostname))
    ) {
      throw new ServiceError(
        badRequestError({
          message: 'URI must use https scheme unless it targets localhost'
        })
      );
    }

    if (url.username || url.password) {
      throw new ServiceError(
        badRequestError({
          message: 'URI must not contain username or password'
        })
      );
    }
  } catch (e) {
    if (isServiceError(e)) throw e;

    throw new ServiceError(
      badRequestError({
        message: 'Invalid URI'
      })
    );
  }
};
