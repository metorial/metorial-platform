import { defineSettings } from '@metorial/settings';
import { redisUrl } from '@metorial/shared-settings';
import { v } from '@lowerdeck/validation';

export let env = defineSettings({
  service: {
    REDIS_URL: redisUrl,
    DATABASE_URL: v.string(),

    NEBULA_API_PORT: v.optional(v.number())
  },

  provider: {
    DEFAULT_PROVIDER: v.enumOf(['aws.kms', 'gcp.kms', 'azure.keyvault', 'local']),
    TENANT_PROVIDER_TYPES: v.optional(v.string())
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

  gcp: {
    GCP_KMS_DEFAULT_KEY: v.optional(v.string()),
    GCP_KMS_CREDENTIALS_JSON: v.optional(v.string()),
    GCP_KMS_EXTERNAL_PRINCIPAL: v.optional(v.string())
  },

  azure: {
    AZURE_KMS_DEFAULT_VAULT_URL: v.optional(v.string()),
    AZURE_KMS_DEFAULT_KEY_NAME: v.optional(v.string()),
    AZURE_KMS_TENANT_ID: v.optional(v.string()),
    AZURE_KMS_CLIENT_ID: v.optional(v.string()),
    AZURE_KMS_CLIENT_SECRET: v.optional(v.string()),
    AZURE_KMS_CLIENT_CERTIFICATE_PEM: v.optional(v.string()),
    AZURE_KMS_CLIENT_CERTIFICATE_PATH: v.optional(v.string())
  },

  consumerAuth: {
    CONSUMER_INSTANCE_TOKEN_SECRET: v.string(),
    CONSUMER_INSTANCE_TOKEN_TTL_SECONDS: v.optional(v.string())
  }
});

export type ProviderType = 'aws_kms' | 'gcp_kms' | 'azure_key_vault' | 'local';

let providerTypeByDefaultProvider = {
  'aws.kms': 'aws_kms',
  'gcp.kms': 'gcp_kms',
  'azure.keyvault': 'azure_key_vault',
  local: 'local'
} as const;

let providerTypes = Object.values(providerTypeByDefaultProvider) as ProviderType[];

export let defaultProviderType: ProviderType =
  providerTypeByDefaultProvider[env.provider.DEFAULT_PROVIDER];

export let tenantProviderTypes: ProviderType[] = (
  env.provider.TENANT_PROVIDER_TYPES?.split(',')
    .map(type => type.trim())
    .filter(Boolean) ?? []
).map(type => {
  if (!providerTypes.includes(type as ProviderType)) {
    throw new Error(`TENANT_PROVIDER_TYPES contains unknown provider type "${type}"`);
  }

  return type as ProviderType;
});

export let isTenantProviderTypeEnabled = (type: ProviderType) =>
  tenantProviderTypes.length
    ? tenantProviderTypes.includes(type)
    : type === defaultProviderType;

export let consumerRegistrationSecrets = Object.entries(process.env).flatMap(
  ([key, secret]) => {
    if (!key.startsWith('CONSUMER_REGISTRATION_') || !secret) return [];

    let identifier = key.slice('CONSUMER_REGISTRATION_'.length).toLowerCase();
    if (!identifier) return [];

    return [{ identifier, secret }];
  }
);

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

if (env.provider.DEFAULT_PROVIDER === 'local' && process.env.NODE_ENV === 'production') {
  throw new Error('Local provider cannot be used in production');
}

if (
  env.provider.DEFAULT_PROVIDER === 'local' &&
  (env.local.LOCAL_MASTER_SECRET?.length ?? 0) < 32
) {
  throw new Error('LOCAL_MASTER_SECRET must be at least 32 characters');
}

if (env.provider.DEFAULT_PROVIDER === 'aws.kms' && !env.kms.KMS_AWS_REGION) {
  throw new Error('KMS_AWS_REGION is required when DEFAULT_PROVIDER=aws.kms');
}

if (env.provider.DEFAULT_PROVIDER === 'gcp.kms' && !env.gcp.GCP_KMS_DEFAULT_KEY) {
  throw new Error('GCP_KMS_DEFAULT_KEY is required when DEFAULT_PROVIDER=gcp.kms');
}

if (
  env.provider.DEFAULT_PROVIDER === 'azure.keyvault' &&
  (!env.azure.AZURE_KMS_DEFAULT_VAULT_URL || !env.azure.AZURE_KMS_DEFAULT_KEY_NAME)
) {
  throw new Error(
    'AZURE_KMS_DEFAULT_VAULT_URL and AZURE_KMS_DEFAULT_KEY_NAME are required when DEFAULT_PROVIDER=azure.keyvault'
  );
}

if (tenantProviderTypes.includes('gcp_kms') && !env.gcp.GCP_KMS_EXTERNAL_PRINCIPAL) {
  throw new Error('GCP_KMS_EXTERNAL_PRINCIPAL is required to enable gcp_kms for tenants');
}

if (
  tenantProviderTypes.includes('azure_key_vault') &&
  (!env.azure.AZURE_KMS_TENANT_ID ||
    !env.azure.AZURE_KMS_CLIENT_ID ||
    !(
      env.azure.AZURE_KMS_CLIENT_SECRET ||
      env.azure.AZURE_KMS_CLIENT_CERTIFICATE_PEM ||
      env.azure.AZURE_KMS_CLIENT_CERTIFICATE_PATH
    ))
) {
  throw new Error(
    'AZURE_KMS_TENANT_ID, AZURE_KMS_CLIENT_ID and a client secret or certificate are required to enable azure_key_vault for tenants'
  );
}
