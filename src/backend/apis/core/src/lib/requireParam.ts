import { badRequestError, ServiceError } from '@mtsrc/error';

export let requireParam = (params: Record<string, string | undefined>, key: string) => {
  let value = params[key];
  if (!value) {
    throw new ServiceError(
      badRequestError({
        message: `${key} is required`,
        description: `The ${key} path parameter is required.`
      })
    );
  }

  return value;
};
