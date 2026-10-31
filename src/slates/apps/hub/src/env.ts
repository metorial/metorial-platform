import { v } from '@lowerdeck/validation';
import { defineSettings } from '@metorial/settings';
import {
  metorialEnv,
  metorialRegion,
  objectStorageUrl,
  redisUrl,
  serviceUrl
} from '@metorial/shared-settings';

export let env = defineSettings({
  service: {
    REDIS_URL: redisUrl,
    DATABASE_URL: v.string(),

    SERVICE_PUBLIC_URL: v.string(),
    METORIAL_ENV: metorialEnv,
    METORIAL_REGION: metorialRegion,
    METORIAL_API_URL: v.optional(v.string()),

    SLATES_HUB_PUBLIC_PORT: v.optional(v.number()),
    SLATES_HUB_INTERNAL_PORT: v.optional(v.number()),
    SLATES_HUB_ADMIN_PORT: v.optional(v.number())
  },

  functionBay: {
    FUNCTION_BAY_API_URL: serviceUrl('functionBay'),
    FUNCTION_BAY_TENANT_IDENTIFIER: v.string(),

    FUNCTION_BAY_DEFAULT_MEMORY_MB: v.number(),
    FUNCTION_BAY_DEFAULT_TIMEOUT_SECONDS: v.number()
  },

  storage: {
    OBJECT_STORAGE_URL: objectStorageUrl,
    INVOCATIONS_BUCKET_NAME: v.string(),
    MAX_ATTACHMENT_SIZE_BYTES: v.optional(v.number())
  },

  encryption: {
    ENCRYPTION_KEY: v.string()
  },

  registry: {
    INITIAL_REGISTRIES: v.optional(v.string()),
    SLATES_REGISTRY_URL: v.optional(v.string()),
    SLATES_SUB_REGISTRY_ID: v.optional(v.string()),
    SUPPORTS_PREBUILT_SLATES: v.optional(v.boolean()),
    // npm registry for slate deployment installs; npm's default when unset.
    SLATE_DEPLOYMENT_NPM_REGISTRY_URL: v.optional(v.string())
  },

  ares: {
    ARES_AUTH_URL: v.optional(v.string()),
    ARES_INTERNAL_URL: v.optional(v.string()),
    SLATES_ADMIN_ALLOWED_EMAIL_DOMAINS: v.optional(v.string())
  },

  slates: {
    SLATES_HUB_INSTANCE_IDENTIFIER: v.string(),
    SLATES_WEBHOOK_SYNC_TIMEOUT_MS: v.optional(v.number()),
    SLATES_WEBHOOK_TRIGGER_HOST: v.optional(v.string())
  },

  nebula: {
    NEBULA_API_URL: serviceUrl('nebula'),
    NEBULA_CONSUMER_IDENTIFIER: v.string(),
    NEBULA_CONSUMER_TOKEN: v.string()
  },

  secrets: {
    SLATES_DELEGATE_SECRETS_TO_NEBULA: v.boolean(),
    SLATE_ATTACHMENT_SIGNING_SECRET: v.string(),
    TOOL_ATTACHMENT_ROUTER_SECRET: v.optional(v.string())
  },

  subspace: {
    SUBSPACE_INTERNAL_URL: v.optional(v.string())
  }
});
