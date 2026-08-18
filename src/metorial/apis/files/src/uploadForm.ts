import { badRequestError, ServiceError } from '@lowerdeck/error';

export let parseStoreReplace = (value: FormDataEntryValue | null, hasStore: boolean) => {
  if (value !== null && value !== 'true' && value !== 'false') {
    throw new ServiceError(
      badRequestError({
        message: 'store_replace must be true or false'
      })
    );
  }

  let replace = value === 'true';
  if (replace && !hasStore) {
    throw new ServiceError(
      badRequestError({
        message: 'store_replace requires store_id and path'
      })
    );
  }

  return replace;
};
