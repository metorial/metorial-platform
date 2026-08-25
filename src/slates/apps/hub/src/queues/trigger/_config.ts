export let TRIGGER_POLL_SEARCH_BATCH_SIZE = 1000;

export let TRIGGER_POLL_CLAIM_DURATION_MINUTES = 30;

export let TRIGGER_POLL_MIN_INTERVAL_SECONDS = 15 * 60;

export let TRIGGER_POLL_MAX_FAILURE_BACKOFF_SECONDS = 5 * 60;

export let triggerPollWorkerOpts = {
  concurrency: 5,
  limiter: {
    max: 25,
    duration: 10_000
  }
};

export let TRIGGER_WEBHOOK_REGISTER_MAX_ATTEMPTS = 5;
