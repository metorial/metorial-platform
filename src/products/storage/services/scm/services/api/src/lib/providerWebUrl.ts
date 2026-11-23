import { badRequestError, ServiceError } from '@lowerdeck/error';

let isHttpUrl = (value: string) => {
  try {
    let { protocol } = new URL(value);

    return protocol === 'http:' || protocol === 'https:';
  } catch {
    return false;
  }
};

export let getProviderWebUrl = (value: unknown) => {
  if (typeof value != 'string' || !isHttpUrl(value)) {
    throw new ServiceError(
      badRequestError({
        message: 'The source control provider returned an invalid repository URL.'
      })
    );
  }

  return value;
};
