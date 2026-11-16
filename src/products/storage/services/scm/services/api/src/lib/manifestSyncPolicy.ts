import { badRequestError, createError, ServiceError } from '@lowerdeck/error';

// A 4xx so the RPC client doesn't retry it; callers back off on their own.
export let manifestSyncDisabledError = createError({
  status: 409,
  code: 'manifest_sync_disabled',
  message: 'Manifest repository syncs are temporarily disabled'
});

export let assertManifestSyncAllowed = (
  settings: {
    ORIGIN_MANIFEST_SYNC_ENABLED: boolean;
    ORIGIN_MANIFEST_SOURCE_BUCKETS: string[];
  },
  buckets: string[]
) => {
  if (!settings.ORIGIN_MANIFEST_SYNC_ENABLED) {
    throw new ServiceError(manifestSyncDisabledError());
  }

  for (let bucket of buckets) {
    if (!settings.ORIGIN_MANIFEST_SOURCE_BUCKETS.includes(bucket)) {
      throw new ServiceError(
        badRequestError({ message: `Bucket ${bucket} is not an allowed manifest source` })
      );
    }
  }
};
