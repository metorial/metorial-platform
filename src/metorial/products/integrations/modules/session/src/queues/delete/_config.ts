export { getCutoffDate } from '@metorial-subspace/archived-cleanup';

export let RETENTION_BATCH_SIZE = 500;

export let sessionRetentionCleanupWorkerOpts = {
  concurrency: 2,
  limiter: {
    max: 2,
    duration: 1000
  }
};

export let sessionRetentionStorageCleanupWorkerOpts = {
  concurrency: 5,
  limiter: {
    max: 5,
    duration: 1000
  }
};
