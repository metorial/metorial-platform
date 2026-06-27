import { createValidatedEnv } from '@lowerdeck/env';
import { v } from '@lowerdeck/validation';

export let env = createValidatedEnv({
  service: {
    METORIAL_REGION: v.optional(v.enumOf(['us1', 'eu1'])),
    GLOBAL_DB_TRANSACTION_MAX_WAIT_MS: v.optional(v.number()),
    GLOBAL_DB_TRANSACTION_TIMEOUT_MS: v.optional(v.number()),
    GLOBAL_DB_KEEPALIVE_INTERVAL_MS: v.optional(v.number()),
    GLOBAL_DB_POOL_IDLE_TIMEOUT_MS: v.optional(v.number()),
    GLOBAL_DB_CONNECTION_TIMEOUT_MS: v.optional(v.number()),
    INTERNAL_MULTI_REGION_ENDPOINT: v.string(),
    EXTERNAL_MULTI_REGION_ENDPOINT: v.string()
  }
});
