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

  observer: {
    OBSERVER_QUERY_URL: v.optional(v.string())
  },

  provider: {
    DEFAULT_PROVIDER: v.enumOf(['aws.lambda', 'local'])
  },

  deflector: {
    DEFLECTOR_PROXY_URL: v.optional(v.string()),
    DEFLECTOR_JWT_SECRET: v.optional(v.string()),
    DEFLECTOR_JWT_AUDIENCE: v.optional(v.string())
  },

  lambda: {
    LAMBDA_AWS_REGION: v.optional(v.string()),

    LAMBDA_AWS_ACCESS_KEY_ID: v.optional(v.string()),
    LAMBDA_AWS_SECRET_ACCESS_KEY: v.optional(v.string()),

    LAMBDA_EXECUTION_ROLE_ARN: v.optional(v.string()),
    LAMBDA_NETWORK_CONFIG: v.optional(v.string())
  }
});

if (env.provider.DEFAULT_PROVIDER === 'local' && process.env.NODE_ENV === 'production') {
  throw new Error('Local provider cannot be used in production');
}

export type LambdaNetworkConfig = {
  region?: string;
  executionRoleArn?: string;
  vpcId?: string;
  vpcArn?: string;
  subnetIds: string[];
  subnetArns?: string[];
  securityGroupIds: string[];
  securityGroupArns?: string[];
};

export let lambdaNetworkConfig = (() => {
  let raw = env.lambda.LAMBDA_NETWORK_CONFIG;
  if (!raw) return undefined;

  let parsed: LambdaNetworkConfig;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('LAMBDA_NETWORK_CONFIG must be valid JSON');
  }

  if (!Array.isArray(parsed.subnetIds) || parsed.subnetIds.length === 0) {
    throw new Error('LAMBDA_NETWORK_CONFIG.subnetIds must contain at least one subnet ID');
  }
  if (
    !Array.isArray(parsed.securityGroupIds) ||
    parsed.securityGroupIds.length === 0
  ) {
    throw new Error(
      'LAMBDA_NETWORK_CONFIG.securityGroupIds must contain at least one security group ID'
    );
  }

  return parsed;
})();
