import { checkEdition, perEdition } from '@metorial/editions';
import { defineSettings, setting } from '@metorial/settings';
import { objectStorageUrl, redisUrl } from '@metorial/shared-settings';
import { v } from '@lowerdeck/validation';

export let env = defineSettings({
  service: {
    REDIS_URL: redisUrl,
    DATABASE_URL: v.string(),

    FUNCTION_BAY_API_PORT: v.optional(v.number())
  },

  storage: {
    OBJECT_STORAGE_URL: objectStorageUrl,
    BUNDLE_BUCKET_NAME: v.string()
  },

  encryption: {
    ENCRYPTION_KEY: v.string()
  },

  forge: {
    FORGE_API_URL: v.string()
  },

  observer: {
    OBSERVER_QUERY_URL: setting(v.optional(v.string()), {
      description:
        'Legacy observer query URL, used for network logs when NETWORK_LOGS_URL is unset'
    })
  },

  networkLogs: {
    NETWORK_LOGS_URL: setting(v.optional(v.string()), {
      description: 'Network log store RPC endpoint'
    }),
    NETWORK_LOGS_TOKEN_FILE: setting(v.optional(v.string()), {
      description: 'Projected service account token (audience metorial-network-logs)',
      default: perEdition({
        cloud: undefined,
        'on-prem': '/var/run/secrets/metorial/network-logs/token'
      })
    }),
    NETWORK_LOGS_RPC_SECRET: setting(v.optional(v.string()), {
      secret: true,
      description: 'Shared HMAC secret for the network log store, used instead of a token file'
    })
  },

  provider: {
    DEFAULT_PROVIDER: v.enumOf(['aws.lambda', 'local', 'knative'])
  },

  runtime: {
    RUNTIME_SIGNING_KEY: setting(v.optional(v.string()), {
      secret: true,
      description:
        'Base64url Ed25519 seed that signs egress grants and invocation tokens (derived from METORIAL_SECRET on-prem)'
    }),
    RUNTIME_SIGNING_KEY_ID: setting(v.optional(v.string()), {
      description:
        'Key id for RUNTIME_SIGNING_KEY, defaults to the id derived from its public key'
    })
  },

  egressGateway: {
    EGRESS_GATEWAY_PROXY_URL: setting(v.optional(v.string()), {
      description: 'Egress gateway proxy that Lambda functions send outbound traffic through'
    })
  },

  clusterManager: {
    CLUSTER_MANAGER_URL: setting(v.optional(v.string()), {
      description: 'Cluster-manager control endpoint, required for the knative provider'
    }),
    CLUSTER_MANAGER_TOKEN_FILE: setting(v.optional(v.string()), {
      description: 'Projected service account token (audience metorial-cluster-manager)',
      default: perEdition({
        cloud: undefined,
        'on-prem': '/var/run/secrets/metorial/cluster-manager/token'
      })
    }),
    KNATIVE_BOOT_ALLOWANCE_SECONDS: setting(v.number(), {
      default: 60,
      description: 'Added to the function timeout for the knative invoke deadline (cold start)'
    })
  },

  lambda: {
    LAMBDA_AWS_REGION: v.optional(v.string()),

    LAMBDA_AWS_ACCESS_KEY_ID: v.optional(v.string()),
    LAMBDA_AWS_SECRET_ACCESS_KEY: v.optional(v.string()),

    LAMBDA_EXECUTION_ROLE_ARN: v.optional(v.string()),
    LAMBDA_NETWORK_CONFIG: v.optional(v.string())
  }
});

// On-prem installations run the local provider in production unless the operator connects a cloud one.
if (
  env.provider.DEFAULT_PROVIDER === 'local' &&
  process.env.NODE_ENV === 'production' &&
  !checkEdition('on-prem')
) {
  throw new Error('Local provider cannot be used in production');
}

if (env.provider.DEFAULT_PROVIDER === 'knative' && !env.clusterManager.CLUSTER_MANAGER_URL) {
  throw new Error('CLUSTER_MANAGER_URL is required for the knative provider');
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
