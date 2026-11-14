import { subDays } from 'date-fns';

export let RETENTION_BATCH_SIZE = 500;

export let SERVER_DISCOVERY_RETENTION_DAYS = 2;

export let retentionCleanupWorkerOpts = {
  concurrency: 2,
  limiter: {
    max: 2,
    duration: 1000
  }
};

export let getRetentionCutoffDate = (logRetentionInDays: number) => {
  return subDays(new Date(), Math.max(logRetentionInDays, 0));
};
