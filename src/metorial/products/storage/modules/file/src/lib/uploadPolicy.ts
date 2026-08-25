export let uploadUrlExpirationSecs = 15 * 60;

export let pendingUploadTtlMs = 24 * 60 * 60 * 1000;

/** Ceiling for content the client PUTs straight to object storage. */
export let maxUploadSize = 2 * 1024 * 1024 * 1024;

/** Ceiling for content streamed through the API service, which has to hold it in memory. */
export let maxDirectUploadSize = 100 * 1024 * 1024;

/**
 * Multipart framing and the accompanying form fields sit on top of the file itself, so
 * the request body is allowed to be slightly larger than the file it carries.
 */
export let maxDirectUploadBodySize = maxDirectUploadSize + 1024 * 1024;

export let getUploadUrlExpiresAt = () => new Date(Date.now() + uploadUrlExpirationSecs * 1000);

export let getPendingUploadExpiresAt = () => new Date(Date.now() + pendingUploadTtlMs);

let isPositiveInteger = (size: unknown) =>
  typeof size === 'number' && Number.isSafeInteger(size) && size > 0;

let isValidSize = (size: unknown, max: number) => isPositiveInteger(size) && (size as number) <= max;

export let isValidUploadSize = (size: unknown) => isValidSize(size, maxUploadSize);

export let isValidDirectUploadSize = (size: unknown) => isValidSize(size, maxDirectUploadSize);

let byteUnits = ['bytes', 'KB', 'MB', 'GB'];

export let formatByteSize = (bytes: number) => {
  let value = bytes;
  let unit = 0;

  while (value >= 1024 && unit < byteUnits.length - 1) {
    value /= 1024;
    unit++;
  }

  return `${Number.isInteger(value) ? value : value.toFixed(1)} ${byteUnits[unit]}`;
};

/**
 * Explains a rejected size in human terms. Sizes are accepted as `unknown` because
 * the API deliberately lets any value through validation so that this message, rather
 * than a schema error, is what the caller sees.
 */
export let describeInvalidUploadSize = (d: { size: unknown; max: number }) => {
  if (!isPositiveInteger(d.size)) {
    return 'File size must be the size of the file in bytes, given as a whole number greater than zero.';
  }

  return `Files can be at most ${formatByteSize(d.max)}, but this one is ${formatByteSize(d.size as number)}.`;
};

export let useUploadUrlHint = `Set mode to "get_upload_url" to upload files of up to ${formatByteSize(maxUploadSize)} directly to object storage.`;

export let doesUploadedObjectMatch = (d: { declaredSize: number; actualSize: number }) =>
  d.declaredSize === d.actualSize;
