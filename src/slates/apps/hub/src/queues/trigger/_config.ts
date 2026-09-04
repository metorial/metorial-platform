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

export let TRIGGER_EVENT_MAP_MAX_ATTEMPTS = 25;

export let TRIGGER_EVENT_MAP_MAX_BACKOFF_MS = 5 * 60 * 1000;

export let triggerEventMapBackoffMs = (attempt: number) =>
  Math.min(2 ** attempt * 1000, TRIGGER_EVENT_MAP_MAX_BACKOFF_MS);

export let TRIGGER_RAW_EVENT_FAILED_RETENTION_DAYS = 5;

export let TRIGGER_RAW_EVENT_IDEMPOTENCY_KEY_TTL_HOURS = 24;
