import type {
  Provider,
  ProviderAuthMethod,
  ProviderSpecification,
  ProviderTool,
  ProviderTrigger
} from '@metorial-subspace/db';
import { providerAuthMethodPresenter } from './providerAuthMethod';
import { providerToolPresenter } from './providerTool';
import { providerTriggerPresenter } from './providerTrigger';

export let providerSpecificationPresenter = (
  providerSpecification: ProviderSpecification & {
    provider: Provider;
    providerTools: ProviderTool[];
    providerAuthMethods: ProviderAuthMethod[];
    providerTriggers: ProviderTrigger[];
  }
) => ({
  object: 'provider.capabilities.specification',

  id: providerSpecification.id,
  key: providerSpecification.key,

  name: providerSpecification.name,
  description: providerSpecification.description,

  providerId: providerSpecification.provider.id,

  configSchema: providerSpecification.value.specification.configJsonSchema,
  configVisibility: providerSpecification.value.specification.configVisibility,

  tools: providerSpecification.providerTools.map(t =>
    providerToolPresenter({
      ...t,
      specification: providerSpecification,
      provider: providerSpecification.provider
    })
  ),

  triggers: providerSpecification.providerTriggers.map(t =>
    providerTriggerPresenter({
      ...t,
      specification: providerSpecification,
      provider: providerSpecification.provider
    })
  ),

  authMethods: providerSpecification.providerAuthMethods.map(am =>
    providerAuthMethodPresenter({
      ...am,
      specification: providerSpecification,
      provider: providerSpecification.provider
    })
  ),

  createdAt: providerSpecification.createdAt,
  updatedAt: providerSpecification.updatedAt
});
