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

// Provider cleanup tries other connection credentials on retry; after the last attempt
// the target is deleted locally regardless.
export let TRIGGER_WEBHOOK_UNREGISTER_MAX_ATTEMPTS = 10;

// A failed target is only re-registered on rediscovery when it changed, a new connection
// linked it, or this much time has passed since the last failure.
export let TRIGGER_WEBHOOK_FAILED_RETRY_COOLDOWN_MS = 6 * 60 * 60 * 1000;

// Targets stuck in a transitional status (or active without any active connection) for this
// long are handed to the unregister queue again by the hourly sweep.
export let TRIGGER_WEBHOOK_TARGET_STALE_AFTER_MS = 60 * 60 * 1000;

// Complete discovery scans can prune links that have not been seen for this long.
export let TRIGGER_WEBHOOK_TARGET_PRUNE_AFTER_MS = 24 * 60 * 60 * 1000;

export let TRIGGER_EVENT_MAP_MAX_ATTEMPTS = 25;

export let TRIGGER_EVENT_DELIVER_MAX_ATTEMPTS = 25;

export let TRIGGER_EVENT_MAP_MAX_BACKOFF_MS = 5 * 60 * 1000;

export let triggerEventMapBackoffMs = (attempt: number) =>
  Math.min(2 ** attempt * 1000, TRIGGER_EVENT_MAP_MAX_BACKOFF_MS);

export let TRIGGER_RAW_EVENT_FAILED_RETENTION_DAYS = 5;

export let TRIGGER_RAW_EVENT_IDEMPOTENCY_KEY_TTL_HOURS = 24;
