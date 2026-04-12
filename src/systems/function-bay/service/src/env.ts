import { createValidatedEnv } from '@lowerdeck/env';
import { v } from '@lowerdeck/validation';

export let env = createValidatedEnv({
  service: {
    REDIS_URL: v.string(),
    DATABASE_URL: v.string()
  },

  storage: {
    OBJECT_STORAGE_URL: v.string(),
    BUNDLE_BUCKET_NAME: v.string()
  },

  encryption: {
    ENCRYPTION_KEY: v.string()
  },

  forge: {
    FORGE_API_URL: v.string()
  },

  provider: {
    DEFAULT_PROVIDER: v.enumOf(['aws.lambda'])
  },

  lambda: {
    LAMBDA_AWS_REGION: v.optional(v.string()),

    LAMBDA_AWS_ACCESS_KEY_ID: v.optional(v.string()),
    LAMBDA_AWS_SECRET_ACCESS_KEY: v.optional(v.string()),

    LAMBDA_EXECUTION_ROLE_ARN: v.optional(v.string())
  }
});
