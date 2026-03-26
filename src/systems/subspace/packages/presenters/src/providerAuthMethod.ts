import { shadowId } from '@lowerdeck/shadow-id';
import type {
  Provider,
  ProviderAuthMethod,
  ProviderSpecification
} from '@metorial-subspace/db';

export let providerAuthMethodPresenter = (
  providerAuthMethod: ProviderAuthMethod & {
    provider: Provider;
    specification: Omit<ProviderSpecification, 'value'>;
  }
) => ({
  object: 'provider.capabilities.auth_method',

  id: providerAuthMethod.id,
  key: providerAuthMethod.key,
  type: providerAuthMethod.type,

  name: providerAuthMethod.name,
  description: providerAuthMethod.description,

  capabilities: providerAuthMethod.value.capabilities,

  inputJsonSchema: providerAuthMethod.value.inputJsonSchema,
  outputJsonSchema: providerAuthMethod.value.outputJsonSchema,

  scopes:
    providerAuthMethod.type === 'oauth'
      ? (providerAuthMethod.value.scopes ?? []).map(s => ({
          object: 'provider.capabilities.auth_method.scope',
          ...s,
          scope: s.id,
          id: shadowId('pamsco_', [providerAuthMethod.id], [s.id])
        }))
      : null,

  specificationId: providerAuthMethod.specification.id,
  providerId: providerAuthMethod.provider.id,

  createdAt: providerAuthMethod.createdAt,
  updatedAt: providerAuthMethod.updatedAt
});
