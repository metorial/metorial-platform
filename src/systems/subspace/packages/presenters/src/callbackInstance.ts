import type { createSlatesHubInternalClient } from '@metorial-services/slates-hub-client';
import type {
  CallbackInstance,
  CallbackReceiverRegistration,
  Provider,
  ProviderDeploymentConfigPair,
  ProviderSpecification,
  ProviderTrigger
} from '@metorial-subspace/db';
import { providerTriggerPresenter } from './providerTrigger';

type SlatesClient = ReturnType<typeof createSlatesHubInternalClient>;

export type CallbackInstanceReceiverTrigger = Awaited<
  ReturnType<SlatesClient['slateTriggerReceiver']['get']>
>['triggers'][number];

export type EnrichedCallbackInstanceTrigger = CallbackInstanceReceiverTrigger & {
  providerTrigger:
    | (ProviderTrigger & {
        provider: Provider;
        specification: Omit<ProviderSpecification, 'value'>;
      })
    | null;
};

let callbackInstanceTriggerPresenter = (trigger: EnrichedCallbackInstanceTrigger) => ({
  object: 'callback.instance.trigger',

  id: trigger.id,
  source: trigger.source,

  pollIntervalSeconds: trigger.pollIntervalSeconds,
  nextPollAt: trigger.nextPollAt,
  lastPolledAt: trigger.lastPolledAt,

  webhookUrl: trigger.webhookUrl,
  isWebhookRegistered: trigger.isWebhookRegistered,

  providerTrigger: trigger.providerTrigger
    ? providerTriggerPresenter(trigger.providerTrigger)
    : null
});

export let callbackInstancePresenter = (
  callbackInstance: CallbackInstance & {
    providerDeploymentConfigPair: ProviderDeploymentConfigPair;
    activeRegistration?: CallbackReceiverRegistration | null;
  },
  receiverTriggers?: EnrichedCallbackInstanceTrigger[]
) => ({
  object: 'callback.instance',

  id: callbackInstance.id,
  status: callbackInstance.status,

  registrationStatus: callbackInstance.registrationStatus,

  triggers: (receiverTriggers ?? []).map(callbackInstanceTriggerPresenter),

  createdAt: callbackInstance.createdAt,
  updatedAt: callbackInstance.updatedAt
});
