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

export let TRIGGER_WEBHOOK_UNREGISTER_MAX_ATTEMPTS = 10;

export let TRIGGER_WEBHOOK_FAILED_RETRY_COOLDOWN_MS = 6 * 60 * 60 * 1000;

// Targets stuck in a transitional status this long are re-queued for unregister by the sweep.
export let TRIGGER_WEBHOOK_TARGET_STALE_AFTER_MS = 60 * 60 * 1000;

export let TRIGGER_WEBHOOK_TARGET_PRUNE_AFTER_MS = 24 * 60 * 60 * 1000;

export let TRIGGER_EVENT_MAP_MAX_ATTEMPTS = 25;

export let TRIGGER_EVENT_DELIVER_MAX_ATTEMPTS = 25;

export let TRIGGER_EVENT_MAP_MAX_BACKOFF_MS = 5 * 60 * 1000;

export let triggerEventMapBackoffMs = (attempt: number) =>
  Math.min(2 ** attempt * 1000, TRIGGER_EVENT_MAP_MAX_BACKOFF_MS);

export let TRIGGER_RAW_EVENT_FAILED_RETENTION_DAYS = 5;

export let TRIGGER_RAW_EVENT_IDEMPOTENCY_KEY_TTL_HOURS = 24;

export let TRIGGER_GATEWAY_TICK_MS = 10_000;

export let TRIGGER_GATEWAY_LEASE_MS = 60_000;

export let TRIGGER_GATEWAY_MAX_CONNECTIONS_PER_WORKER = 250;

export let TRIGGER_GATEWAY_FRAME_BATCH_DELAY_MS = 100;

export let TRIGGER_GATEWAY_STATE_PERSIST_INTERVAL_MS = 5_000;

export let TRIGGER_GATEWAY_CONTEXT_TTL_MS = 5 * 60 * 1000;

export let TRIGGER_GATEWAY_MAX_RECONNECT_BACKOFF_MS = 5 * 60 * 1000;

export let TRIGGER_GATEWAY_MAX_BATCH_FRAMES = 100;

export let TRIGGER_GATEWAY_MAX_PENDING_FRAMES = 5_000;

export let TRIGGER_GATEWAY_HEALTHY_UPTIME_MS = 30_000;

export let TRIGGER_GATEWAY_CONNECT_FAILURES_BEFORE_ERROR = 5;

// Reconnect when no frame arrives for this long, heartbeat or not.
export let TRIGGER_GATEWAY_IDLE_TIMEOUT_MS = 2 * 60_000;

export let TRIGGER_GATEWAY_HEARTBEAT_ACK_RECHECK_MS = 1_000;

// Attempt 0 waits 1-5 s, as Discord requires after an invalid session.
export let triggerGatewayReconnectBackoffMs = (attempt: number) =>
  attempt === 0
    ? 1000 + Math.random() * 4000
    : Math.min(
        2 ** attempt * 1000 + Math.random() * 1000,
        TRIGGER_GATEWAY_MAX_RECONNECT_BACKOFF_MS
      );
