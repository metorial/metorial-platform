import { badRequestError, ServiceError } from '@lowerdeck/error';
import { maxDirectUploadBodySize } from '@metorial/module-file';

/**
 * Rejects oversized multipart uploads before the body is buffered into memory. The exact
 * per-file limit is still enforced once the form has been parsed.
 */
export let assertDirectUploadBodySize = (contentLength: string | undefined) => {
  let length = contentLength ? Number(contentLength) : Number.NaN;
  if (!Number.isFinite(length) || length <= maxDirectUploadBodySize) return;

  throw new ServiceError(
    badRequestError({
      message: `Uploads sent through the API must be at most ${maxDirectUploadBodySize} bytes. Use mode "get_upload_url" to upload larger files directly to object storage.`
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
