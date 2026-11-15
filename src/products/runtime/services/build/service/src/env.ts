import { checkEdition, perEdition } from '@metorial/editions';
import { defineSettings, setting } from '@metorial/settings';
import { objectStorageUrl, redisUrl } from '@metorial/shared-settings';
import { v } from '@lowerdeck/validation';
import { defaultBuildEgressHosts } from './lib/buildEgressPolicy';

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
    DEFAULT_PROVIDER: v.enumOf(['aws.code-build', 'local', 'kubernetes']),
    LOCAL_MAX_PENDING_RUNS: v.optional(v.number())
  },

  clusterManager: {
    CLUSTER_MANAGER_URL: setting(v.optional(v.string()), {
      description: 'Cluster-manager control endpoint, required for the kubernetes provider'
    }),
    CLUSTER_MANAGER_TOKEN_FILE: setting(v.optional(v.string()), {
      description: 'Projected service account token (audience metorial-cluster-manager)',
      default: perEdition({
        cloud: undefined,
        'on-prem': '/var/run/secrets/metorial/cluster-manager/token'
      })
    })
  },

  kubernetes: {
    KUBERNETES_BUILD_TIMEOUT_SECONDS: setting(
      v.number({ modifiers: [v.minValue(60), v.maxValue(7200)] }),
      { default: 3600, description: 'Deadline of a kubernetes build Job' }
    ),
    BUILD_SIGNING_KEY: setting(v.optional(v.string()), {
      secret: true,
      description:
        'Base64url Ed25519 seed that signs build egress grants, required for the kubernetes provider'
    }),
    BUILD_SIGNING_KEY_ID: setting(v.optional(v.string()), {
      description:
        'Key id for BUILD_SIGNING_KEY, defaults to the id derived from its public key'
    }),
    SLATE_DEPLOYMENT_NPM_REGISTRY_URL: setting(v.optional(v.string()), {
      description:
        'npm registry slate builds install from, allowed by the default build egress'
    }),
    BUILD_EGRESS_HOSTS: setting.list(v.string(), {
      default: resolved =>
        defaultBuildEgressHosts(resolved.kubernetes?.SLATE_DEPLOYMENT_NPM_REGISTRY_URL),
      description:
        'Hosts kubernetes builds may reach through the egress gateway: "pattern" or "pattern:port", e.g. "*.example.com:443"'
    }),
    BUILD_EGRESS_CIDRS: setting.list(v.string(), {
      default: [],
      description:
        'Address ranges kubernetes builds may reach: "cidr" or "cidr:from-to", e.g. "10.20.0.0/16:443"'
    })
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

// On-prem installations run the local provider in production unless the operator connects a cloud one.
if (
  env.provider.DEFAULT_PROVIDER === 'local' &&
  process.env.NODE_ENV === 'production' &&
  !checkEdition('on-prem')
) {
  throw new Error('Local provider cannot be used in production');
}

if (env.provider.DEFAULT_PROVIDER === 'kubernetes') {
  if (!env.clusterManager.CLUSTER_MANAGER_URL) {
    throw new Error('CLUSTER_MANAGER_URL is required for the kubernetes provider');
  }
  if (!env.kubernetes.BUILD_SIGNING_KEY) {
    throw new Error('BUILD_SIGNING_KEY is required for the kubernetes provider');
  }
}
