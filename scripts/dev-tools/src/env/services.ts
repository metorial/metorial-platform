import { HOSTNAME } from '../const';
import type { Env } from './type';

export let originServiceEnv: Env = [
  {
    key: 'DATABASE_URL',
    defaultValue: 'postgresql://postgres:postgres@localhost:35432/origin'
  },
  {
    key: 'REDIS_URL',
    defaultValue: 'redis://localhost:36379/0'
  },
  {
    key: 'ORIGIN_SERVICE_PUBLIC_URL',
    defaultValue: `http://${HOSTNAME}:52093`
  },
  {
    key: 'OBJECT_STORAGE_URL',
    defaultValue: 'http://services:52010'
  },
  {
    key: 'CODE_BUCKET_OBJECT_STORAGE_BUCKET',
    defaultValue: 'code-bucket'
  },
  {
    key: 'CODE_BUCKET_SERVICE_URL',
    defaultValue: `${HOSTNAME}:5050`
  },
  {
    key: 'CODE_BUCKET_EDITOR_URL',
    defaultValue: `http://${HOSTNAME}:52092`
  },
  {
    key: 'SCM_GITHUB_APP_ID',
    isRequired: false
  },
  {
    key: 'SCM_GITHUB_APP_SLUG',
    isRequired: false
  },
  {
    key: 'SCM_GITHUB_APP_PRIVATE_KEY_BASE_64',
    isRequired: false
  },
  {
    key: 'SCM_GITHUB_APP_CLIENT_ID',
    isRequired: false
  },
  {
    key: 'SCM_GITHUB_APP_CLIENT_SECRET',
    isRequired: false
  },
  {
    key: 'SCM_GITLAB_CLIENT_ID',
    isRequired: false
  },
  {
    key: 'SCM_GITLAB_CLIENT_SECRET',
    isRequired: false
  }
];

export let originCodeBucketEnv: Env = [
  {
    key: 'CODE_BUCKET_JWT_SECRET',
    defaultValue: 'origin-code-bucket-dev-secret'
  },
  {
    key: 'CODE_BUCKET_OBJECT_STORAGE_ENDPOINT',
    defaultValue: 'http://services:52010'
  },
  {
    key: 'CODE_BUCKET_OBJECT_STORAGE_BUCKET',
    defaultValue: 'code-bucket'
  },
  {
    key: 'CODE_BUCKET_REDIS_URL',
    defaultValue: 'redis://localhost:36379/0'
  },
  {
    key: 'CODE_BUCKET_HTTP_ADDRESS',
    defaultValue: ':52091'
  },
  {
    key: 'CODE_BUCKET_RPC_ADDRESS',
    defaultValue: ':5050'
  },
  {
    key: 'CODE_BUCKET_WORKSPACE_ADDRESS',
    defaultValue: ':52092'
  },
  {
    key: 'CODE_BUCKET_EDITOR_API_URL',
    defaultValue: `http://${HOSTNAME}:52091`
  }
];

export let signalServiceEnv: Env = [
  {
    key: 'DATABASE_URL',
    defaultValue: 'postgresql://postgres:postgres@localhost:35432/signal'
  },
  {
    key: 'REDIS_URL',
    defaultValue: 'redis://localhost:36379/0'
  },
  {
    key: 'OBJECT_STORAGE_URL',
    defaultValue: 'http://services:52010'
  },
  {
    key: 'LOGS_BUCKET_NAME',
    defaultValue: 'signal-logs'
  }
];

export let slatesHubEnv: Env = [
  {
    key: 'DATABASE_URL',
    defaultValue: 'postgresql://postgres:postgres@localhost:35432/slates-hub'
  },
  {
    key: 'REDIS_URL',
    defaultValue: 'redis://localhost:36379/0'
  },
  {
    key: 'ENCRYPTION_KEY',
    defaultValue: 'sTrG+z8ewVo7JJsgmv39UL/YDdgxlHSVhVPJOV7Omdg'
  },
  {
    key: 'FUNCTION_BAY_API_URL',
    defaultValue: 'http://localhost:52030/metorial-function-bay'
  },
  {
    key: 'FUNCTION_BAY_TENANT_IDENTIFIER',
    defaultValue: 'dev-tenant'
  },
  {
    key: 'FUNCTION_BAY_DEFAULT_MEMORY_MB',
    defaultValue: '512'
  },
  {
    key: 'FUNCTION_BAY_DEFAULT_TIMEOUT_SECONDS',
    defaultValue: '15'
  },
  {
    key: 'SIGNAL_API_URL',
    defaultValue: `http://localhost:52050/metorial-signal`
  },
  {
    key: 'SIGNAL_SENDER_IDENTIFIER',
    defaultValue: 'dev-slates-hub'
  },
  {
    key: 'OBJECT_STORAGE_URL',
    defaultValue: 'http://services:52010'
  },
  {
    key: 'INVOCATIONS_BUCKET_NAME',
    defaultValue: 'dev-invocations'
  },
  {
    key: 'SLATES_HUB_INSTANCE_IDENTIFIER',
    defaultValue: 'dev-slates-hub'
  },
  {
    key: 'SERVICE_PUBLIC_URL',
    defaultValue: `http://${HOSTNAME}:52045`
  },
  {
    key: 'ARES_AUTH_URL',
    defaultValue: 'http://localhost:52120'
  },
  {
    key: 'ARES_INTERNAL_URL',
    defaultValue: 'http://localhost:52123/metorial-ares-internal/api'
  }
];

export let slatesRegistryEnv: Env = [
  {
    key: 'DATABASE_URL',
    defaultValue: 'postgresql://postgres:postgres@localhost:35432/slates-registry'
  }
];

export let subspaceDevEnv: Env = [
  {
    key: 'DATABASE_URL',
    defaultValue: 'postgresql://postgres:postgres@localhost:35432/subspace'
  },
  {
    key: 'REDIS_URL',
    defaultValue: 'redis://localhost:36379/0'
  },
  {
    key: 'NATS_URL',
    defaultValue: 'nats://localhost:34222'
  },
  {
    key: 'PUBLIC_SERVICE_URL',
    defaultValue: `http://${HOSTNAME}:52071`
  },
  {
    key: 'SHUTTLE_URL',
    defaultValue: `http://${HOSTNAME}:52080/metorial-shuttle`
  },
  {
    key: 'SHUTTLE_LIVE_URL',
    defaultValue: `ws://${HOSTNAME}:52080`
  },
  {
    key: 'SHUTTLE_PUBLIC_URL',
    defaultValue: `http://${HOSTNAME}:52081`
  },
  {
    key: 'SLATES_HUB_URL',
    defaultValue: `http://${HOSTNAME}:52046/slates-hub`
  },
  {
    key: 'SLATES_HUB_PUBLIC_URL',
    defaultValue: `http://${HOSTNAME}:52045`
  },
  {
    key: 'VOYAGER_URL',
    defaultValue: 'http://services:52060/metorial-voyager'
  },
  {
    key: 'OBJECT_STORAGE_URL',
    defaultValue: 'http://services:52010'
  },
  {
    key: 'MESSAGE_BUCKET_NAME',
    defaultValue: 'messages'
  },
  {
    key: 'ORIGIN_URL',
    defaultValue: `http://localhost:52090/metorial-origin`
  },
  {
    key: 'REGISTRY_URL',
    defaultValue:
      'https://metorial-saas-dev.registry.metorial-enterprise.com/metorial-registry-root'
  },
  {
    key: 'SCOUT_URL',
    defaultValue: 'https://scout-fra-fly-prod.metorial-enterprise.com/metorial-scout'
  },
  {
    key: 'SCOUT_TOKEN',
    isRequired: false
  }
];

export let subspaceDbEnv: Env = [
  {
    key: 'DATABASE_URL',
    defaultValue: 'postgresql://postgres:postgres@localhost:35432/subspace'
  },
  {
    key: 'PUBLIC_SERVICE_URL',
    defaultValue: `http://${HOSTNAME}:52071`
  }
];

export let shuttleServiceEnv: Env = [
  {
    key: 'DATABASE_URL',
    defaultValue: 'postgresql://postgres:postgres@localhost:35432/shuttle'
  },
  {
    key: 'REDIS_URL',
    defaultValue: 'redis://localhost:36379/0'
  },
  {
    key: 'PROVIDER_OAUTH_URL',
    defaultValue: `http://${HOSTNAME}:52081`
  },
  {
    key: 'ENCRYPTION_KEY',
    defaultValue: 'local-dev-encryption-key'
  },
  {
    key: 'HOLOPOD_HTTP_ENDPOINT',
    defaultValue: 'http://holopod:3000'
  },
  {
    key: 'SHUTTLE_ALLOW_PRIVATE_URLS',
    defaultValue: 'true'
  },
  {
    key: 'SHUTTLE_UNSAFE_SSRF_BYPASS',
    defaultValue: 'true'
  },
  {
    key: 'OBJECT_STORAGE_URL',
    defaultValue: 'http://services:52010'
  },
  {
    key: 'LOGS_BUCKET_NAME',
    defaultValue: 'shuttle-logs'
  },
  {
    key: 'FUNCTION_BAY_API_URL',
    defaultValue: 'http://localhost:52030/metorial-function-bay'
  },
  {
    key: 'FUNCTION_BAY_TENANT_IDENTIFIER',
    defaultValue: 'dev-tenant'
  },
  {
    key: 'FUNCTION_BAY_DEFAULT_MEMORY_MB',
    defaultValue: '512'
  },
  {
    key: 'FUNCTION_BAY_DEFAULT_TIMEOUT_SECONDS',
    defaultValue: '15'
  }
];

export let forgeServiceEnv: Env = [
  {
    key: 'DATABASE_URL',
    defaultValue: 'postgresql://postgres:postgres@localhost:35432/forge'
  },
  {
    key: 'REDIS_URL',
    defaultValue: 'redis://localhost:36379/0'
  },
  {
    key: 'ENCRYPTION_KEY',
    defaultValue: 'sTrG+z8ewVo7JJsgmv39UL/YDdgxlHSVhVPJOV7Omdg'
  },
  {
    key: 'DEFAULT_PROVIDER',
    defaultValue: 'aws.code-build'
  },
  {
    key: 'OBJECT_STORAGE_URL',
    defaultValue: 'http://services:52010'
  },
  {
    key: 'ARTIFACT_BUCKET_NAME',
    defaultValue: 'artifacts'
  },
  {
    key: 'LOG_BUCKET_NAME',
    defaultValue: 'logs'
  },
  {
    key: 'CODE_BUILD_AWS_REGION',
    isRequired: false
  },
  {
    key: 'CODE_BUILD_AWS_ACCESS_KEY_ID',
    isRequired: false
  },
  {
    key: 'CODE_BUILD_AWS_SECRET_ACCESS_KEY',
    isRequired: false
  },
  {
    key: 'CODE_BUILD_PROJECT_NAME',
    isRequired: false
  },
  {
    key: 'CODE_BUILD_ROLE_ARN',
    isRequired: false
  }
];

export let functionBayServiceEnv: Env = [
  {
    key: 'DATABASE_URL',
    defaultValue: 'postgresql://postgres:postgres@localhost:35432/function-bay'
  },
  {
    key: 'REDIS_URL',
    defaultValue: 'redis://localhost:36379/0'
  },
  {
    key: 'ENCRYPTION_KEY',
    defaultValue: 'sTrG+z8ewVo7JJsgmv39UL/YDdgxlHSVhVPJOV7Omdg'
  },
  {
    key: 'DEFAULT_PROVIDER',
    defaultValue: 'aws.lambda'
  },
  {
    key: 'OBJECT_STORAGE_URL',
    defaultValue: 'http://services:52010'
  },
  {
    key: 'BUNDLE_BUCKET_NAME',
    defaultValue: 'function-bay-bundles'
  },
  {
    key: 'FORGE_API_URL',
    defaultValue: `http://${HOSTNAME}:52020/metorial-forge`
  },
  {
    key: 'LAMBDA_AWS_REGION',
    isRequired: false
  },
  {
    key: 'LAMBDA_AWS_ACCESS_KEY_ID',
    isRequired: false
  },
  {
    key: 'LAMBDA_AWS_SECRET_ACCESS_KEY',
    isRequired: false
  },
  {
    key: 'LAMBDA_EXECUTION_ROLE_ARN',
    isRequired: false
  }
];

export let aresServiceEnv: Env = [
  {
    key: 'DATABASE_URL',
    defaultValue: 'postgresql://postgres:postgres@localhost:35432/ares'
  },
  {
    key: 'SSO_DATABASE_URL',
    defaultValue: 'postgresql://postgres:postgres@localhost:35432/ares-sso'
  },
  {
    key: 'REDIS_URL',
    defaultValue: 'redis://localhost:36379/0'
  },
  {
    key: 'RELAY_URL',
    defaultValue: 'http://services:52110/metorial-relay'
  },
  {
    key: 'ARES_AUTH_URL',
    defaultValue: `http://${HOSTNAME}:52120`
  },
  {
    key: 'ARES_ADMIN_URL',
    defaultValue: `http://${HOSTNAME}:52121`
  },
  {
    key: 'ARES_SSO_URL',
    defaultValue: `http://${HOSTNAME}:52122`
  },
  {
    key: 'EMAIL_NAME',
    defaultValue: 'Ares Dev'
  },
  {
    key: 'EMAIL_ADDRESS',
    defaultValue: 'dev@metorial.com'
  },
  {
    key: 'SAML_AUDIENCE',
    defaultValue: 'https://saml.dev.metorial.com'
  },
  {
    key: 'AUTH_TICKET_SECRET',
    defaultValue: 'dev-secret-change-in-production'
  },
  {
    key: 'TURNSTILE_SITE_KEY',
    isRequired: false
  },
  {
    key: 'TURNSTILE_SECRET_KEY',
    isRequired: false
  }
];

export let horizonServiceEnv: Env = [
  {
    key: 'DATABASE_URL',
    defaultValue: 'postgresql://postgres:postgres@localhost:35432/horizon'
  },
  {
    key: 'REDIS_URL',
    defaultValue: 'redis://localhost:36379/0'
  },
  {
    key: 'RELAY_URL',
    defaultValue: 'http://services:52110/metorial-relay'
  },
  {
    key: 'ARES_AUTH_URL',
    defaultValue: 'http://localhost:52120'
  },
  {
    key: 'ARES_INTERNAL_URL',
    defaultValue: 'http://localhost:52123/metorial-ares-internal/api'
  },
  {
    key: 'EMAIL_NAME',
    defaultValue: 'Horizon Dev'
  },
  {
    key: 'EMAIL_ADDRESS',
    defaultValue: 'dev@metorial.com'
  },
  {
    key: 'COOKIE_DOMAIN',
    defaultValue: HOSTNAME
  },
  {
    key: 'AUTH_URL',
    defaultValue: `http://${HOSTNAME}:52130`
  },
  {
    key: 'ADMIN_URL',
    defaultValue: `http://${HOSTNAME}:52132`
  },
  {
    key: 'DASHBOARD_URL',
    defaultValue: `http://${HOSTNAME}:52134`
  },
  {
    key: 'TICKET_SECRET',
    defaultValue: 'supersecret'
  },
  {
    key: 'INTERNAL_API_SECRET',
    defaultValue: 'supersecret'
  },
  {
    key: 'SLACK_INVITE_BOT_TOKEN',
    isRequired: false
  },
  {
    key: 'SLACK_WEBHOOK_URL',
    isRequired: false
  },
  {
    key: 'ITEM_WEBHOOK_URL',
    isRequired: false
  },
  {
    key: 'ITEM_API_KEY',
    isRequired: false
  },
  {
    key: 'SUPPORT_CRISP_WEBSITE_ID',
    isRequired: false
  },
  {
    key: 'SUPPORT_CRISP_TOKEN_ID',
    isRequired: false
  },
  {
    key: 'SUPPORT_CRISP_TOKEN_KEY',
    isRequired: false
  },
  {
    key: 'ENTERPRISE_FILES_SIGNATURE_PASSWORD',
    isRequired: false
  },
  {
    key: 'ENTERPRISE_FILES_HOST',
    isRequired: false
  }
];
