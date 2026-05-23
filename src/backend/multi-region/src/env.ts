import { createValidatedEnv } from '@mtsrc/env';
import { v } from '@mtsrc/validation';

export let env = createValidatedEnv({
  service: {
    METORIAL_REGION: v.optional(v.enumOf(['us1', 'eu1'])),
    GLOBAL_DB_TRANSACTION_MAX_WAIT_MS: v.optional(v.number()),
    GLOBAL_DB_TRANSACTION_TIMEOUT_MS: v.optional(v.number()),
    GLOBAL_DB_KEEPALIVE_INTERVAL_MS: v.optional(v.number()),
    GLOBAL_DB_POOL_IDLE_TIMEOUT_MS: v.optional(v.number()),
    GLOBAL_DB_CONNECTION_TIMEOUT_MS: v.optional(v.number())
  }
});
