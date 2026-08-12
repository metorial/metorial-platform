import { shadowId } from '@lowerdeck/shadow-id';
import type {
  Provider,
  ProviderAuthMethod,
  ProviderConfig,
  ProviderConfigVault,
  ProviderDeployment,
  ProviderSpecification
} from '@metorial-subspace/db';
import type { PresentedProviderAuthMethod } from '../../../types';

export let presentRawProviderDeploymentPreview = (
  deployment: ProviderDeployment,
  provider: Provider
) => ({
  ...deployment,
  provider
});

export let presentRawProviderAuthMethod = (
  authMethod: ProviderAuthMethod & {
    specification: Omit<ProviderSpecification, 'value'>;
  },
  provider: Provider
) => ({
  id: authMethod.id,
  key: authMethod.key,
  type: authMethod.type as PresentedProviderAuthMethod['type'],
  name: authMethod.name,
  description: authMethod.description,
  capabilities: authMethod.value.capabilities,
  inputJsonSchema: authMethod.value.inputJsonSchema ?? null,
  outputJsonSchema: authMethod.value.outputJsonSchema ?? null,
  scopes:
    authMethod.type === 'oauth'
      ? (authMethod.value.scopes ?? []).map(scope => ({
          object: 'provider.capabilities.auth_method.scope',
          ...scope,
          scope: scope.id,
          id: shadowId('pamsco_', [authMethod.id], [scope.id])
        }))
      : null,
  specificationId: authMethod.specification.id,
  providerId: provider.id,
  createdAt: authMethod.createdAt,
  updatedAt: authMethod.updatedAt
});

export let presentRawProviderConfig = (
  config: ProviderConfig & {
    deployment: ProviderDeployment | null;
    specification: Omit<ProviderSpecification, 'value'>;
    fromVault:
      | (ProviderConfigVault & {
          deployment: ProviderDeployment | null;
        })
      | null;
  },
  provider: Provider
) => ({
  ...config,
  provider,
  deployment: config.deployment
    ? presentRawProviderDeploymentPreview(config.deployment, provider)
    : null,
  fromVault: config.fromVault
    ? {
        ...config.fromVault,
        provider,
        deployment: config.fromVault.deployment
          ? presentRawProviderDeploymentPreview(config.fromVault.deployment, provider)
          : null
      }
    : null
});
