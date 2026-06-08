import type { createSlatesHubInternalClient } from '@metorial-platform-systems/slates-client';
import type {
  CallbackInstance,
  CallbackReceiverRegistration,
  Provider,
  ProviderAuthConfig,
  ProviderAuthConfigVersion,
  ProviderConfig,
  ProviderConfigVersion,
  ProviderDeployment,
  ProviderDeploymentConfigPair,
  ProviderDeploymentVersion,
  ProviderSpecification,
  ProviderTrigger
} from '@metorial-subspace/db';
import { providerDeploymentPreviewPresenter } from './deployment';
import { providerAuthConfigPreviewPresenter } from './providerAuthConfig';
import { providerConfigPreviewPresenter } from './providerConfig';
import { providerTriggerPresenter } from './providerTrigger';

type SlatesClient = ReturnType<typeof createSlatesHubInternalClient>;

export type CallbackInstanceReceiverTrigger = Awaited<
  ReturnType<SlatesClient['slateTriggerReceiver']['get']>
>['triggers'][number];

export type CallbackInstanceReceiver = {
  receiverWebhookUrl: string | null;
  triggers: EnrichedCallbackInstanceTrigger[];
};

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
    providerDeploymentConfigPair: ProviderDeploymentConfigPair & {
      providerDeploymentVersion: ProviderDeploymentVersion & {
        deployment: ProviderDeployment & {
          provider: Provider;
        };
      };
      providerConfigVersion: ProviderConfigVersion & {
        config: ProviderConfig;
      };
      providerAuthConfigVersion:
        | (ProviderAuthConfigVersion & {
            authConfig: ProviderAuthConfig;
          })
        | null;
    };
    slateTriggerReceiverId?: string | null;
    activeRegistration?: CallbackReceiverRegistration | null;
  },
  receiver?: CallbackInstanceReceiver
) => ({
  object: 'callback.instance',

  id: callbackInstance.id,
  status: callbackInstance.status,

  registrationStatus: callbackInstance.registrationStatus,

  deployment: providerDeploymentPreviewPresenter({
    ...callbackInstance.providerDeploymentConfigPair.providerDeploymentVersion.deployment,
    provider:
      callbackInstance.providerDeploymentConfigPair.providerDeploymentVersion.deployment
        .provider
  }),

  config: providerConfigPreviewPresenter({
    ...callbackInstance.providerDeploymentConfigPair.providerConfigVersion.config,
    provider:
      callbackInstance.providerDeploymentConfigPair.providerDeploymentVersion.deployment
        .provider
  }),

  authConfig: callbackInstance.providerDeploymentConfigPair.providerAuthConfigVersion
    ? providerAuthConfigPreviewPresenter({
        ...callbackInstance.providerDeploymentConfigPair.providerAuthConfigVersion.authConfig,
        provider:
          callbackInstance.providerDeploymentConfigPair.providerDeploymentVersion.deployment
            .provider
      })
    : null,

  webhookUrl: receiver?.receiverWebhookUrl ?? null,
  receiverWebhookUrl: receiver?.receiverWebhookUrl ?? null,

  triggers: (receiver?.triggers ?? []).map(callbackInstanceTriggerPresenter),

  createdAt: callbackInstance.createdAt,
  updatedAt: callbackInstance.updatedAt
});
