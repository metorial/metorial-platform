import type { createSlatesHubInternalClient } from '@metorial-platform-systems/slates-client';
import type {
  CallbackInstance,
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
  receiverId: string;
  receiverWebhookUrl: string | null;
  receiverPathSecrets: Array<{
    id: string;
    status: string;
    secretVersion: number;
    validFrom: Date;
    validUntil: Date | null;
    rotatedAt: Date | null;
  }>;
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

export let callbackInstanceTriggerPresenter = (trigger: EnrichedCallbackInstanceTrigger) => ({
  object: 'callback.instance.trigger',

  id: trigger.id,
  source: trigger.source,

  pollIntervalSeconds: trigger.pollIntervalSeconds,
  nextPollAt: trigger.nextPollAt,
  lastPolledAt: trigger.lastPolledAt,

  webhookUrl: trigger.webhookUrl,
  isWebhookRegistered: trigger.isWebhookRegistered,
  registrationStatus: (trigger as any).registrationStatus,
  registrationGeneration: (trigger as any).registrationGeneration,
  registrationTransitionVersion: (trigger as any).registrationTransitionVersion,
  registrationError: (trigger as any).registrationError ?? null,
  verificationMechanism: (trigger as any).verificationMechanism,
  verificationSpecHash: (trigger as any).verificationSpecHash ?? null,

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
    provisionedTenantApps?: Array<{
      id: string;
      generation: number;
      vendor: string;
      credentialOwnerType: 'managed' | 'byo';
      status: string;
      externalAppId: string | null;
      githubManifestStateExpiresAt: Date | null;
      githubManifestCompletedAt: Date | null;
      githubInstallationCompletedAt: Date | null;
    }>;
  },
  receiver?: CallbackInstanceReceiver
) => ({
  object: 'callback.instance',

  id: callbackInstance.id,
  status: callbackInstance.status,

  registrationStatus: callbackInstance.registrationStatus,
  registrationGeneration: callbackInstance.registrationGeneration,
  registrationTransitionVersion: callbackInstance.registrationTransitionVersion,
  registrationError: callbackInstance.registrationErrorCode
    ? {
        code: callbackInstance.registrationErrorCode,
        message: callbackInstance.registrationErrorMessage,
        metadata: callbackInstance.registrationErrorMetadata,
        at: callbackInstance.registrationErrorAt
      }
    : null,
  lastRegistrationSyncError: callbackInstance.lastRegistrationSyncErrorCode
    ? {
        code: callbackInstance.lastRegistrationSyncErrorCode,
        message: callbackInstance.lastRegistrationSyncErrorMessage,
        at: callbackInstance.lastRegistrationSyncErrorAt
      }
    : null,
  verificationMechanism: callbackInstance.verificationMechanism,
  verificationSpecHash: callbackInstance.verificationSpecHash,

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

  security: {
    receiverId: receiver?.receiverId ?? callbackInstance.slateTriggerReceiverId ?? null,
    receiverUrl: receiver?.receiverWebhookUrl ?? null,
    pathSecrets: (receiver?.receiverPathSecrets ?? []).map(secret => ({
      id: secret.id,
      status: secret.status,
      secretVersion: secret.secretVersion,
      validFrom: secret.validFrom,
      validUntil: secret.validUntil,
      rotatedAt: secret.rotatedAt
    })),
    provisionedApps: (callbackInstance.provisionedTenantApps ?? []).map(app => ({
      id: app.id,
      generation: app.generation,
      vendor: app.vendor,
      credentialOwnerType: app.credentialOwnerType,
      status: app.status,
      externalAppId: app.externalAppId,
      githubManifestStateExpiresAt: app.githubManifestStateExpiresAt,
      githubManifestCompletedAt: app.githubManifestCompletedAt,
      githubInstallationCompletedAt: app.githubInstallationCompletedAt
    }))
  },

  triggers: (receiver?.triggers ?? [])
    .filter(trigger => (trigger as any).active !== false)
    .map(callbackInstanceTriggerPresenter),

  createdAt: callbackInstance.createdAt,
  updatedAt: callbackInstance.updatedAt
});
