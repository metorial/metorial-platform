import { defineSettings } from '@metorial/settings';
import { objectStorageUrl, redisUrl } from '@metorial/shared-settings';
import { v } from '@lowerdeck/validation';

export let env = defineSettings({
  service: {
    REDIS_URL: redisUrl,
    DATABASE_URL: v.string(),

    FORGE_API_PORT: v.optional(v.number())
  },

  storage: {
    OBJECT_STORAGE_URL: objectStorageUrl,
    ARTIFACT_BUCKET_NAME: v.string(),
    LOG_BUCKET_NAME: v.string()
  },

  encryption: {
    ENCRYPTION_KEY: v.string()
  },

  provider: {
    DEFAULT_PROVIDER: v.enumOf(['aws.code-build', 'local']),
    LOCAL_MAX_PENDING_RUNS: v.optional(v.number())
  },

  codeBuild: {
    CODE_BUILD_AWS_REGION: v.optional(v.string()),

    CODE_BUILD_AWS_ACCESS_KEY_ID: v.optional(v.string()),
    CODE_BUILD_AWS_SECRET_ACCESS_KEY: v.optional(v.string()),

    // If not provided a new build project will be created
    CODE_BUILD_PROJECT_NAME: v.optional(v.string()),
    // If not provided a new role will be created
    CODE_BUILD_ROLE_ARN: v.optional(v.string()),

    CODE_BUILD_CONCURRENCY_LIMIT: v.optional(v.number()),

    CODE_BUILD_LOG_RETENTION_DAYS: v.optional(v.number()),
    CODE_BUILD_LOG_GROUP_NAME: v.optional(v.string())
  }
});

if (env.provider.DEFAULT_PROVIDER === 'local' && process.env.NODE_ENV === 'production') {
  throw new Error('Local provider cannot be used in production');
}
