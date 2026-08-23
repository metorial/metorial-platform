export { getRetentionCutoffDate } from '@metorial-subspace/list-utils';

export let RETENTION_BATCH_SIZE = 500;

export let retentionCleanupWorkerOpts = {
  concurrency: 2,
  limiter: {
    max: 2,
    duration: 1000
  }
};

export let retentionStorageCleanupWorkerOpts = {
  concurrency: 5,
  limiter: {
    max: 5,
    duration: 1000
  }
};

export let retentionSyncWorkerOpts = {
  concurrency: 5,
  limiter: {
    max: 5,
    duration: 1000
  }
};
