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
    SIGNAL_SENDER_IDENTIFIER: v.string()
  },

  storage: {
    OBJECT_STORAGE_URL: v.string(),
    INVOCATIONS_BUCKET_NAME: v.string()
  },

  encryption: {
    ENCRYPTION_KEY: v.string()
  },

  registry: {
    INITIAL_REGISTRIES: v.optional(v.string())
  },

  ares: {
    ARES_AUTH_URL: v.optional(v.string()),
    ARES_INTERNAL_URL: v.optional(v.string())
  },

  slates: {
    SLATES_HUB_INSTANCE_IDENTIFIER: v.string()
  },

  slackEvents: {
    /** Single Slack app Signing Secret (Events API). */
    SLACK_EVENTS_SIGNING_SECRET: v.optional(v.string()),
    /** Optional JSON map of Slack `api_app_id` → signing secret for multiple Slack apps. */
    SLACK_EVENTS_SIGNING_SECRETS_JSON: v.optional(v.string())
  }
});
