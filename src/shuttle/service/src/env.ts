import { createValidatedEnv } from '@lowerdeck/env';
import { v } from '@lowerdeck/validation';

export let env = createValidatedEnv({
  service: {
    REDIS_URL: v.string(),
    DATABASE_URL: v.string(),
    PROVIDER_OAUTH_URL: v.string(),

    SHUTTLE_API_PORT: v.optional(v.number()),
    SHUTTLE_PUBLIC_PORT: v.optional(v.number())
  },

  encryption: {
    ENCRYPTION_KEY: v.string()
  },

  holopod: {
    HOLOPOD_HTTP_ENDPOINT: v.optional(v.string()),
    HOLOPOD_HTTP_ENDPOINT_TLS: v.optional(v.boolean()),
    HOLOPOD_HTTP_ROOT_CA_CERT_BASE64: v.optional(v.string()),
    HOLOPOD_NETWORK_DNS_SERVERS: v.optional(v.string())
  },

  storage: {
    OBJECT_STORAGE_URL: v.string(),
    LOGS_BUCKET_NAME: v.string()
  },

  functionBay: {
    FUNCTION_BAY_API_URL: v.string(),
    FUNCTION_BAY_TENANT_IDENTIFIER: v.string(),

    FUNCTION_BAY_DEFAULT_MEMORY_MB: v.number(),
    FUNCTION_BAY_DEFAULT_TIMEOUT_SECONDS: v.number()
  },

  nebula: {
    NEBULA_API_URL: v.string(),
    NEBULA_CONSUMER_IDENTIFIER: v.string(),
    NEBULA_CONSUMER_TOKEN: v.string()
  },

  secrets: {
    SHUTTLE_DELEGATE_SECRETS_TO_NEBULA: v.boolean()
  }
});

export let getHolopodHttpEndpoint = () => {
  let endpoint = env.holopod.HOLOPOD_HTTP_ENDPOINT?.trim();
  if (!endpoint) {
    throw new Error('Holopod is not configured: HOLOPOD_HTTP_ENDPOINT is not set');
  }
  return endpoint;
};
