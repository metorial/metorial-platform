import { defineSettings } from '@metorial/settings';
import { objectStorageUrl, redisUrl } from '@metorial/shared-settings';
import { v } from '@lowerdeck/validation';

export let env = defineSettings({
  service: {
    REDIS_URL: redisUrl,
    DATABASE_URL: v.string()
  },

  storage: {
    OBJECT_STORAGE_URL: objectStorageUrl,
    PACKAGE_BUCKET_NAME: v.string()
  },

  access: {
    PUBLIC_ACCESS_PERMITTED: v.optional(v.boolean())
  },

  url: {
    SERVICE_PUBLIC_URL: v.string(),
    SUB_REGISTRY_BASE_DOMAIN: v.optional(v.string())
  },

  ports: {
    SLATES_REGISTRY_PUBLIC_PORT: v.optional(v.number()),
    SLATES_REGISTRY_INTERNAL_PORT: v.optional(v.number()),
    SLATES_REGISTRY_ADMIN_PORT: v.optional(v.number())
  },

  mirror: {
    SLATES_REGISTRY_MODE: v.optional(v.enumOf(['root', 'mirror'])),
    SLATES_SIGNATURE_VERIFICATION: v.optional(v.enumOf(['required', 'disabled'])),
    SLATES_UPSTREAM_REGISTRIES: v.optional(v.string()),
    SLATES_PACK_MAX_BYTES: v.optional(v.number())
  },

  encryption: {
    SLATES_REGISTRY_ENCRYPTION_KEY: v.optional(v.string())
  },

  ares: {
    ARES_AUTH_URL: v.optional(v.string()),
    ARES_CLIENT_ID: v.optional(v.string()),
    SLATES_ADMIN_ALLOWED_EMAIL_DOMAINS: v.optional(v.string())
  }
});
