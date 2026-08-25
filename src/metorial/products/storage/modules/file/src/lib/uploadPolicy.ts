export let uploadUrlExpirationSecs = 15 * 60;

export let pendingUploadTtlMs = 24 * 60 * 60 * 1000;

/** S3 rejects single-PUT objects above 5 GiB and the object store exposes no multipart API. */
export let maxUploadSize = 5 * 1024 * 1024 * 1024;

export let getUploadUrlExpiresAt = () => new Date(Date.now() + uploadUrlExpirationSecs * 1000);

export let getPendingUploadExpiresAt = () => new Date(Date.now() + pendingUploadTtlMs);

export let isValidUploadSize = (size: number) =>
  Number.isSafeInteger(size) && size > 0 && size <= maxUploadSize;

export let doesUploadedObjectMatch = (d: { declaredSize: number; actualSize: number }) =>
  d.declaredSize === d.actualSize;
