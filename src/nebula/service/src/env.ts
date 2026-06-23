import { createValidatedEnv } from '@lowerdeck/env';
import { v } from '@lowerdeck/validation';

export let env = createValidatedEnv({
  service: {
    REDIS_URL: v.string(),
    DATABASE_URL: v.string()
  },

  provider: {
    DEFAULT_PROVIDER: v.enumOf(['aws.kms', 'local'])
  },

  local: {
    LOCAL_MASTER_SECRET: v.optional(v.string())
  },

  kms: {
    KMS_AWS_REGION: v.optional(v.string()),
    KMS_AWS_ACCESS_KEY_ID: v.optional(v.string()),
    KMS_AWS_SECRET_ACCESS_KEY: v.optional(v.string()),
    KMS_DEFAULT_KEY_ID: v.optional(v.string()),
    KMS_CREATE_DEFAULT_KEY: v.optional(v.string()),
    KMS_EXTERNAL_KEY_ROLE_ARN: v.optional(v.string())
  },

  consumerAuth: {
    CONSUMER_INSTANCE_TOKEN_SECRET: v.string(),
    CONSUMER_INSTANCE_TOKEN_TTL_SECONDS: v.optional(v.string())
  }
});

export let consumerRegistrationSecrets = Object.entries(process.env).flatMap(([key, secret]) => {
  if (!key.startsWith('CONSUMER_REGISTRATION_') || !secret) return [];

  let identifier = key.slice('CONSUMER_REGISTRATION_'.length).toLowerCase();
  if (!identifier) return [];

  return [{ identifier, secret }];
});

export let consumerInstanceTokenTtlSeconds = (() => {
  let value = env.consumerAuth.CONSUMER_INSTANCE_TOKEN_TTL_SECONDS;
  if (!value) return 60 * 60;

  let parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error('CONSUMER_INSTANCE_TOKEN_TTL_SECONDS must be a positive number');
  }

  return Math.floor(parsed);
})();

if (env.consumerAuth.CONSUMER_INSTANCE_TOKEN_SECRET.length < 32) {
  throw new Error('CONSUMER_INSTANCE_TOKEN_SECRET must be at least 32 characters');
}

if (
  env.provider.DEFAULT_PROVIDER === 'local' &&
  process.env.NODE_ENV === 'production'
) {
  throw new Error('Local provider cannot be used in production');
}

if (env.provider.DEFAULT_PROVIDER === 'local' && (env.local.LOCAL_MASTER_SECRET?.length ?? 0) < 32) {
  throw new Error('LOCAL_MASTER_SECRET must be at least 32 characters');
}

if (env.provider.DEFAULT_PROVIDER === 'aws.kms' && !env.kms.KMS_AWS_REGION) {
  throw new Error('KMS_AWS_REGION is required when DEFAULT_PROVIDER=aws.kms');
}
