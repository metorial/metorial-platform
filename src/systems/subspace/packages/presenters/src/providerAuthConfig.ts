import type {
  Provider,
  ProviderAuthConfig,
  ProviderAuthCredentials,
  ProviderAuthMethod,
  ProviderDeployment,
  ProviderSpecification
} from '@metorial-subspace/db';
import { providerAuthCredentialsPresenter } from './authCredentials';
import { providerDeploymentPreviewPresenter } from './deployment';
import { providerAuthMethodPresenter } from './providerAuthMethod';

export let providerAuthConfigPresenter = (
  providerAuthConfig: ProviderAuthConfig & {
    provider: Provider;
    deployment: ProviderDeployment | null;
    authCredentials: ProviderAuthCredentials | null;
    authMethod: ProviderAuthMethod & { specification: Omit<ProviderSpecification, 'value'> };
  }
) => ({
  object: 'provider.auth_config',

  id: providerAuthConfig.id,
  type: providerAuthConfig.type,
  source: providerAuthConfig.source,
  status: providerAuthConfig.status,

  isEphemeral: providerAuthConfig.isEphemeral,
  isDefault: providerAuthConfig.isDefault,

  providerId: providerAuthConfig.provider.id,

  name: providerAuthConfig.name,
  description: providerAuthConfig.description,
  metadata: providerAuthConfig.metadata,

  deploymentPreview: providerAuthConfig.deployment
    ? providerDeploymentPreviewPresenter({
        ...providerAuthConfig.deployment,
        provider: providerAuthConfig.provider
      })
    : null,

  credentials: providerAuthConfig.authCredentials
    ? providerAuthCredentialsPresenter({
        ...providerAuthConfig.authCredentials,
        provider: providerAuthConfig.provider
      })
    : null,

  authMethod: providerAuthMethodPresenter({
    ...providerAuthConfig.authMethod,
    provider: providerAuthConfig.provider
  }),

  createdAt: providerAuthConfig.createdAt,
  updatedAt: providerAuthConfig.updatedAt
});

export let providerAuthConfigPreviewPresenter = (
  providerAuthConfig: ProviderAuthConfig & {
    provider: Provider;
  }
) => ({
  object: 'provider.auth_config',

  id: providerAuthConfig.id,
  type: providerAuthConfig.type,
  source: providerAuthConfig.source,

  isEphemeral: providerAuthConfig.isEphemeral,
  isDefault: providerAuthConfig.isDefault,

  providerId: providerAuthConfig.provider.id,

  name: providerAuthConfig.name,
  description: providerAuthConfig.description,
  metadata: providerAuthConfig.metadata,

  createdAt: providerAuthConfig.createdAt,
  updatedAt: providerAuthConfig.updatedAt
});

export let providerAuthConfigSchemaPresenter = (d: {
  provider: Provider;
  specification: ProviderSpecification;
  authMethod: ProviderAuthMethod;
}) => ({
  object: 'provider.capabilities.auth_config.schema',

  authConfigSchema: d.authMethod.value.inputJsonSchema,

  authConfigVisibility: 'encrypted' as const,

  specificationId: d.specification.id,
  providerId: d.provider.id,

  createdAt: d.authMethod.createdAt,
  updatedAt: d.authMethod.updatedAt
});

export let providerAuthConfigImportSchemaPresenter = (d: {
  provider: Provider;
  specification: ProviderSpecification;
  authMethod: ProviderAuthMethod;
}) => ({
  object: 'provider.capabilities.auth_config.schema',

  authConfigSchema:
    d.authMethod.type === 'oauth'
      ? d.authMethod.value.outputJsonSchema
      : d.authMethod.value.inputJsonSchema,

  authConfigVisibility: 'encrypted' as const,

  specificationId: d.specification.id,
  providerId: d.provider.id,

  createdAt: d.authMethod.createdAt,
  updatedAt: d.authMethod.updatedAt
});

export let providerAuthConfigExportSchemaPresenter = (d: {
  provider: Provider;
  specification: ProviderSpecification;
  authMethod: ProviderAuthMethod;
}) => ({
  object: 'provider.capabilities.auth_config.schema',

  authConfigSchema: d.authMethod.value.outputJsonSchema,

  authConfigVisibility: 'encrypted' as const,

  specificationId: d.specification.id,
  providerId: d.provider.id,

  createdAt: d.authMethod.createdAt,
  updatedAt: d.authMethod.updatedAt
});
