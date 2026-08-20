import { createValidatedEnv } from '@lowerdeck/env';
import { v } from '@lowerdeck/validation';

export let env = createValidatedEnv({
  service: {
    REDIS_URL: v.string(),

    PUBLIC_SERVICE_URL: v.string(),
    SLATES_HUB_SECRET_RPC_URL: v.optional(v.string()),
    SLATES_HUB_SUBSPACE_SECRET_RPC_TOKEN_CURRENT: v.optional(v.string()),
    PROVISIONED_APP_VENDOR_SERVICE_URL: v.optional(v.string()),
    PROVISIONED_APP_VENDOR_SERVICE_TOKEN: v.optional(v.string()),
    GITHUB_MANIFEST_REDIRECT_URL: v.optional(v.string()),
    SLACK_MANAGER_APP_PROVISIONING_ENABLED: v.optional(v.boolean())
  },

  encryption: {
    ENCRYPTION_KEY: v.string(),
    ENCRYPTION_KEYRING_JSON: v.optional(v.string()),
    ENCRYPTION_ACTIVE_KEY_VERSION: v.optional(v.number()),
    ENCRYPTION_ACTIVE_AAD_VERSION: v.optional(v.number()),
    ENCRYPTION_SUPPORTED_AAD_VERSIONS: v.optional(v.string())
  }
});
