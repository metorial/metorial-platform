import type { Provider, ProviderSpecification, ProviderTrigger } from '@metorial-subspace/db';
import { projectStoredSpecificationTriggerWebhookHttp } from '@metorial-subspace/provider-utils/src/types/webhookVerification';

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
  eventTypes: providerTrigger.value.eventTypes,
  scopes: providerTrigger.value.scopes ?? null,
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
          },
          http: projectStoredSpecificationTriggerWebhookHttp(
            (providerTrigger.value.invocation as { http?: unknown }).http
          )
        },

  specificationId: providerTrigger.specification.id,
  providerId: providerTrigger.provider.id,

  createdAt: providerTrigger.createdAt,
  updatedAt: providerTrigger.updatedAt
});
