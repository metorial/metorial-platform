import { subDays } from 'date-fns';

export let getCutoffDate = () => subDays(new Date(), 14);

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

export let getRetentionCutoffDate = (logRetentionInDays: number) => {
  let cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - Math.max(logRetentionInDays, 0));
  return cutoffDate;
};
