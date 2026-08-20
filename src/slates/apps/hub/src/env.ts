import { createValidatedEnv } from '@lowerdeck/env';
import { v } from '@lowerdeck/validation';

export let env = createValidatedEnv({
  service: {
    REDIS_URL: v.string(),
    DATABASE_URL: v.string(),

    SERVICE_PUBLIC_URL: v.string(),
    METORIAL_ENV: v.enumOf(['development', 'staging', 'production'])
  },

  functionBay: {
    FUNCTION_BAY_API_URL: v.string(),
    FUNCTION_BAY_TENANT_IDENTIFIER: v.string(),

    FUNCTION_BAY_DEFAULT_MEMORY_MB: v.number(),
    FUNCTION_BAY_DEFAULT_TIMEOUT_SECONDS: v.number()
  },

  signal: {
    SIGNAL_API_URL: v.string(),
    SIGNAL_SENDER_IDENTIFIER: v.string(),
    SIGNAL_SERVICE_CREDENTIAL: v.string()
  },

  storage: {
    OBJECT_STORAGE_URL: v.string(),
    INVOCATIONS_BUCKET_NAME: v.string()
  },

  encryption: {
    ENCRYPTION_KEY: v.string(),
    ENCRYPTION_KEYRING_JSON: v.optional(v.string()),
    ENCRYPTION_ACTIVE_KEY_VERSION: v.optional(v.number()),
    ENCRYPTION_ACTIVE_AAD_VERSION: v.optional(v.number()),
    ENCRYPTION_SUPPORTED_AAD_VERSIONS: v.optional(v.string())
  },

  registry: {
    INITIAL_REGISTRIES: v.optional(v.string()),
    SUPPORTS_PREBUILT_SLATES: v.optional(v.boolean())
  },

  ares: {
    ARES_AUTH_URL: v.optional(v.string()),
    ARES_INTERNAL_URL: v.optional(v.string())
  },

  slates: {
    SLATES_HUB_INSTANCE_IDENTIFIER: v.string(),
    SLATES_WEBHOOK_SYNC_TIMEOUT_MS: v.optional(v.number()),
    SLATES_HUB_SECRET_RPC_TOKEN: v.optional(v.string()),
    SLATES_HUB_SUBSPACE_SECRET_RPC_TOKEN_CURRENT: v.optional(v.string()),
    SLATES_HUB_SUBSPACE_SECRET_RPC_TOKEN_PREVIOUS: v.optional(v.string()),
    SLATES_WEBHOOK_REPLAY_KEY: v.optional(v.string()),
    SLATES_CONFIG_SECRET_MIGRATION_MODE: v.optional(
      v.enumOf(['dual_write_plaintext', 'marker_cutover'])
    )
  },

  nebula: {
    NEBULA_API_URL: v.string(),
    NEBULA_CONSUMER_IDENTIFIER: v.string(),
    NEBULA_CONSUMER_TOKEN: v.string()
  },

  secrets: {
    SLATES_DELEGATE_SECRETS_TO_NEBULA: v.boolean()
  }
});
