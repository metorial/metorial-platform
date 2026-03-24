import type { Provider, ProviderSpecification, ProviderTrigger } from '@metorial-subspace/db';

export let providerTriggerPresenter = (
  providerTrigger: ProviderTrigger & {
    provider: Provider;
    specification: Omit<ProviderSpecification, 'value'>;
  }
) => ({
  object: 'provider.capabilities.trigger',

  id: providerTrigger.id,
  key: providerTrigger.key,

  name: providerTrigger.name,
  description: providerTrigger.description,

  inputJsonSchema: providerTrigger.value.inputJsonSchema,
  outputJsonSchema: providerTrigger.value.outputJsonSchema,
  invocation:
    providerTrigger.value.invocation.type === 'polling'
      ? {
          type: 'polling',
          intervalSeconds: providerTrigger.value.invocation.intervalSeconds
        }
      : {
          type: 'webhook',
          autoRegistration: {
            status: providerTrigger.value.invocation.autoRegistration
              ? 'supported'
              : 'unsupported'
          },
          autoUnregistration: {
            status: providerTrigger.value.invocation.autoUnregistration
              ? 'supported'
              : 'unsupported'
          }
        },

  specificationId: providerTrigger.specification.id,
  providerId: providerTrigger.provider.id,

  createdAt: providerTrigger.createdAt,
  updatedAt: providerTrigger.updatedAt
});
