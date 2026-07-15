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
  },
  {
    key: 'SCM_BITBUCKET_CLIENT_ID',
    isRequired: false
  },
  {
    key: 'SCM_BITBUCKET_CLIENT_SECRET',
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

export let synthesisServiceEnv: Env = [
  {
    key: 'SYNTHESIS_DATABASE_URL',
    defaultValue: 'postgresql://postgres:postgres@localhost:35432/synthesis'
  },
  {
    key: 'REDIS_URL',
    defaultValue: 'redis://localhost:36379/0'
  },
  {
    key: 'SYNTHESIS_API_PORT',
    defaultValue: '52160'
  },
  {
    key: 'SYNTHESIS_HEALTH_PORT',
    defaultValue: '12121'
  },
  { key: 'AI_GATEWAY_API_KEY', isRequired: false },
  {
    key: 'SCOUT_URL',
    defaultValue: 'https://scout-fra-fly-prod.metorial-enterprise.com/metorial-scout'
  },
  {
    key: 'SCOUT_TOKEN',
    isRequired: false
  },
  { key: 'SUBSPACE_SOLUTION', defaultValue: 'metorial-dev' },
  { key: 'SUBSPACE_URL', defaultValue: 'http://localhost:52070/subspace-controller' },
  {
    key: 'SUBSPACE_CONNECTION_URL',
    defaultValue: 'http://localhost:52072'
  }
];

export let cargoServiceEnv: Env = [
  {
    key: 'DATABASE_URL',
    defaultValue: 'postgresql://postgres:postgres@localhost:35432/cargo'
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
    key: 'FILES_BUCKET_NAME',
    defaultValue: 'mte-files'
  },
  {
    key: 'DOWNLOAD_PUBLIC_URL',
    defaultValue: `http://${HOSTNAME}:52151`
  },
  {
    key: 'CARGO_REGION',
    defaultValue: 'dev'
  },
  {
    key: 'SIGNED_DOWNLOAD_URL_TOKEN_SECRET',
    defaultValue: 'dev-cargo-download-token-secret'
  },
  {
    key: 'CARGO_API_PORT',
    defaultValue: '52150'
  },
  {
    key: 'CARGO_CONTENT_PORT',
    defaultValue: '52151'
  },
  {
    key: 'CARGO_HEALTH_PORT',
    defaultValue: '12121'
  },
  {
    key: 'API_URL',
    defaultValue: `http://${HOSTNAME}:4310`
  },
  {
    key: 'ORIGIN_URL',
    defaultValue: `http://${HOSTNAME}:52090/metorial-origin`
  },
  {
    key: 'CODE_BUCKET_SERVICE_URL',
    defaultValue: `${HOSTNAME}:5050`
  },
  {
    key: 'VOYAGER_URL',
    defaultValue: 'http://localhost:52060/metorial-voyager'
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
    defaultValue: '60'
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
  // {
  //   key: 'ARES_AUTH_URL',
  //   defaultValue: 'http://services:52120'
  // },
  // {
  //   key: 'ARES_INTERNAL_URL',
  //   defaultValue: 'http://services:52123/metorial-ares-internal/api'
  // }
  {
    key: 'SUPPORTS_PREBUILT_SLATES',
    defaultValue: 'true'
  },
  {
    key: 'NEBULA_API_URL',
    defaultValue: 'http://localhost:52170/metorial-nebula'
  },
  {
    key: 'NEBULA_CONSUMER_IDENTIFIER',
    defaultValue: 'dev-slates-hub'
  },
  {
    key: 'NEBULA_CONSUMER_TOKEN',
    defaultValue: 'local-dev-nebula-slates-registration-secret'
  },
  {
    key: 'SLATES_DELEGATE_SECRETS_TO_NEBULA',
    defaultValue: 'true'
  }
];

export let slatesRegistryEnv: Env = [
  {
    key: 'DATABASE_URL',
    defaultValue: 'postgresql://postgres:postgres@localhost:35432/slates-registry'
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
    key: 'PACKAGE_BUCKET_NAME',
    defaultValue: 'package-bucket'
  },
  {
    key: 'NPM_REGISTRY_URL',
    defaultValue: 'https://registry.npmjs.org'
  },
  {
    key: 'NPM_SEARCH_URL',
    defaultValue: 'https://registry.npmjs.org/-/v1/search'
  },
  {
    key: 'NPM_TOKEN',
    isRequired: false
  },
  {
    key: 'SERVICE_PUBLIC_URL',
    defaultValue: `http://${HOSTNAME}:52040`
  },
  {
    key: 'NPM_ORG',
    defaultValue: 'slates-integrations'
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
    defaultValue: 'http://localhost:52060/metorial-voyager'
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
    key: 'PROVIDER_TELEMETRY_ERROR_GROUPS_BUCKET_NAME',
    defaultValue: 'provider-telemetry-error-groups'
  },
  {
    key: 'ORIGIN_URL',
    defaultValue: `http://localhost:52090/metorial-origin`
  },
  {
    key: 'REGISTRY_URL',
    defaultValue:
      'https://metorial-saas-dev2.registry.metorial-enterprise.com/metorial-registry-root'
  },
  {
    key: 'SCOUT_URL',
    defaultValue: 'https://scout-fra-fly-prod.metorial-enterprise.com/metorial-scout'
  },
  {
    key: 'SCOUT_TOKEN',
    isRequired: false
  },
  {
    key: 'SIGNAL_API_URL',
    defaultValue: `http://localhost:52050/metorial-signal`
  },
  {
    key: 'CARGO_API_URL',
    defaultValue: 'http://localhost:52150/metorial-cargo'
  },
  {
    key: 'FUNCTION_BAY_API_URL',
    defaultValue: 'http://localhost:52030/metorial-function-bay'
  }
  // {
  //   key: 'SIGNAL_SENDER_IDENTIFIER',
  //   defaultValue: 'dev-subspace'
  // },
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
  },
  {
    key: 'NEBULA_API_URL',
    defaultValue: 'http://localhost:52170/metorial-nebula'
  },
  {
    key: 'NEBULA_CONSUMER_IDENTIFIER',
    defaultValue: 'dev-shuttle'
  },
  {
    key: 'NEBULA_CONSUMER_TOKEN',
    defaultValue: 'local-dev-nebula-shuttle-registration-secret'
  },
  {
    key: 'SHUTTLE_DELEGATE_SECRETS_TO_NEBULA',
    defaultValue: 'true'
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
    defaultValue: 'local' // aws.code-build
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
  }
  // {
  //   key: 'CODE_BUILD_AWS_REGION',
  //   isRequired: false
  // },
  // {
  //   key: 'CODE_BUILD_AWS_ACCESS_KEY_ID',
  //   isRequired: false
  // },
  // {
  //   key: 'CODE_BUILD_AWS_SECRET_ACCESS_KEY',
  //   isRequired: false
  // },
  // {
  //   key: 'CODE_BUILD_PROJECT_NAME',
  //   isRequired: false
  // },
  // {
  //   key: 'CODE_BUILD_ROLE_ARN',
  //   isRequired: false
  // }
];

export let nebulaServiceEnv: Env = [
  {
    key: 'DATABASE_URL',
    defaultValue: 'postgresql://postgres:postgres@localhost:35432/nebula'
  },
  {
    key: 'REDIS_URL',
    defaultValue: 'redis://localhost:36379/0'
  },
  {
    key: 'DEFAULT_PROVIDER',
    defaultValue: 'local'
  },
  {
    key: 'LOCAL_MASTER_SECRET',
    defaultValue: 'local-dev-nebula-master-secret-with-enough-entropy'
  },
  {
    key: 'KMS_AWS_REGION',
    defaultValue: 'us-east-1'
  },
  {
    key: 'KMS_CREATE_DEFAULT_KEY',
    defaultValue: 'false'
  },
  {
    key: 'CONSUMER_INSTANCE_TOKEN_SECRET',
    defaultValue: 'local-dev-nebula-consumer-token-secret-with-enough-entropy'
  },
  {
    key: 'CONSUMER_INSTANCE_TOKEN_TTL_SECONDS',
    defaultValue: '3600'
  },
  {
    key: 'CONSUMER_REGISTRATION_SLATES',
    defaultValue: 'local-dev-nebula-slates-registration-secret'
  },
  {
    key: 'CONSUMER_REGISTRATION_SHUTTLE',
    defaultValue: 'local-dev-nebula-shuttle-registration-secret'
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
    defaultValue: 'local' // aws.lambda
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
  }
];

export let voyagerServiceEnv: Env = [
  {
    key: 'DATABASE_URL',
    defaultValue: 'postgresql://postgres:postgres@localhost:35432/voyager'
  },
  {
    key: 'SEARCH_DATABASE_URL',
    defaultValue: 'postgresql://postgres:postgres@localhost:35432/voyager-search'
  },
  {
    key: 'REDIS_URL',
    defaultValue: 'redis://localhost:36379/0'
  }
];

export let relayServiceEnv: Env = [
  {
    key: 'DATABASE_URL',
    defaultValue: 'postgresql://postgres:postgres@localhost:35432/relay'
  },
  {
    key: 'REDIS_URL',
    defaultValue: 'redis://localhost:36379/0'
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
