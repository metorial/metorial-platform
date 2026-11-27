import { badRequestError, ServiceError } from '@lowerdeck/error';

export const assertPublicHttpUrl = async (rawUrl: string) => {
  let parsed: URL;

  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new ServiceError(
      badRequestError({
        message: 'Destination URL must be a valid http(s) URL.'
      })
    );
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new ServiceError(
      badRequestError({
        message: 'Destination URL must be a valid http(s) URL.'
      })
    );
  }

  let hostname = parsed.hostname.toLowerCase();
  if (!hostname) {
    throw new ServiceError(
      badRequestError({
        message: 'Destination URL must include a hostname.'
      })
    );
  }

  return;
};
