export let uploadUrlExpirationSecs = 15 * 60;

export let pendingUploadTtlMs = 24 * 60 * 60 * 1000;

/** Ceiling for content the client PUTs straight to object storage. */
export let maxUploadSize = 100 * 1024 * 1024;

/** Ceiling for content streamed through the API service, which has to hold it in memory. */
export let maxDirectUploadSize = 50 * 1024 * 1024;

/**
 * Multipart framing and the accompanying form fields sit on top of the file itself, so
 * the request body is allowed to be slightly larger than the file it carries.
 */
export let maxDirectUploadBodySize = maxDirectUploadSize + 1024 * 1024;

export let getUploadUrlExpiresAt = () => new Date(Date.now() + uploadUrlExpirationSecs * 1000);

export let getPendingUploadExpiresAt = () => new Date(Date.now() + pendingUploadTtlMs);

let isValidSize = (size: number, max: number) =>
  Number.isSafeInteger(size) && size > 0 && size <= max;

export let isValidUploadSize = (size: number) => isValidSize(size, maxUploadSize);

export let isValidDirectUploadSize = (size: number) => isValidSize(size, maxDirectUploadSize);

export let doesUploadedObjectMatch = (d: { declaredSize: number; actualSize: number }) =>
  d.declaredSize === d.actualSize;
