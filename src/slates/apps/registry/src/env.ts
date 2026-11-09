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

  ares: {
    ARES_AUTH_URL: v.optional(v.string()),
    ARES_CLIENT_ID: v.optional(v.string()),
    SLATES_ADMIN_ALLOWED_EMAIL_DOMAINS: v.optional(v.string())
  }
});
