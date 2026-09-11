import { badRequestError, ServiceError } from '@lowerdeck/error';
import {
  formatByteSize,
  maxDirectUploadBodySize,
  maxDirectUploadSize,
  useUploadUrlHint
} from '@metorial/module-file';

export let assertDirectUploadBodySize = (contentLength: string | undefined) => {
  let length = contentLength ? Number(contentLength) : Number.NaN;
  if (!Number.isFinite(length) || length <= maxDirectUploadBodySize) return;

  throw new ServiceError(
    badRequestError({
      message: `Uploads sent through the API can be at most ${formatByteSize(maxDirectUploadSize)}.`,
      hint: useUploadUrlHint
    })
  );
};

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
