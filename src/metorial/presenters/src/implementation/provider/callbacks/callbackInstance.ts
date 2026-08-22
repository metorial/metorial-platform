import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { callbackInstanceType, callbackReceiverPathSecretType } from '../../../types';
import { v1ProviderAuthConfigPreviewPresenter } from '../auth';
import {
  v1ProviderConfigPreviewPresenter,
  v1ProviderDeploymentPreviewPresenter
} from '../config';
import { v1ProviderTriggerPresenter } from '../provider';

let registrationStatusSchema = v.enumOf([
  'pending',
  'registering',
  'registered',
  'renewing',
  'failed',
  'unregistering',
  'unregistered'
] as const);

let registrationErrorSchema = v.nullable(
  v.object({
    code: v.string(),
    message: v.nullable(v.string()),
    metadata: v.nullable(v.record(v.any())),
    at: v.nullable(v.date())
  })
);

let receiverPathSecretMetadataSchema = v.object({
  object: v.literal('callback.receiver_path_secret#metadata'),
  id: v.string(),
  generation: v.number({ modifiers: [v.integer(), v.positive()] }),
  created_at: v.date(),
  updated_at: v.date()
});

let callbackInstanceTriggerSchema = v.object({
  object: v.literal('callback.instance.trigger', {
    description: "String representing the object's type"
  }),
  id: v.string({
    name: 'id',
    description: 'Unique receiver trigger identifier',
    examples: ['ctr_9gHjKlMnPqRsTuVw']
  }),
  active: v.boolean({
    name: 'active',
    description: 'Whether this receiver trigger is part of the current callback definition'
  }),
  authoritative_state_version: v.number({
    modifiers: [v.integer(), v.positive()],
    description: 'Hub-owned lifecycle state version for this trigger'
  }),
  source: v.enumOf(['polling', 'webhook'] as const, {
    name: 'source',
    description: 'How this trigger is invoked by the provider backend'
  }),
  poll_interval_seconds: v.nullable(
    v.number({
      name: 'poll_interval_seconds',
      description: 'Polling interval in seconds when the trigger uses polling',
      examples: [60]
    })
  ),
  next_poll_at: v.nullable(
    v.date({
      name: 'next_poll_at',
      description: 'Next scheduled poll timestamp for polling triggers',
      examples: [new Date('2026-01-10T14:45:00Z')]
    })
  ),
  last_polled_at: v.nullable(
    v.date({
      name: 'last_polled_at',
      description: 'Last successful poll timestamp for polling triggers',
      examples: [new Date('2026-01-10T14:44:00Z')]
    })
  ),
  webhook_url: v.nullable(
    v.string({
      name: 'webhook_url',
      description:
        'Provider webhook URL registered for this trigger when webhook delivery is used',
      examples: ['https://provider.example.com/webhooks/abc123']
    })
  ),
  is_webhook_registered: v.nullable(
    v.boolean({
      name: 'is_webhook_registered',
      description: 'Whether webhook registration is currently active for this trigger'
    })
  ),
  registration_status: registrationStatusSchema,
  registration_generation: v.number({ modifiers: [v.integer(), v.minValue(0)] }),
  registration_transition_version: v.number({
    modifiers: [v.integer(), v.minValue(0)]
  }),
  registration_error: registrationErrorSchema,
  verification_mechanism: v.enumOf(['path_secret_only', 'hub', 'provider'] as const),
  verification_spec_hash: v.nullable(v.string()),
  provider_trigger: v.nullable(v1ProviderTriggerPresenter.schema)
});

export let v1CallbackInstancePresenter = Presenter.create(callbackInstanceType)
  .presenter(async ({ callbackInstance, receiver }, opts) => {
    let pair = callbackInstance.providerDeploymentConfigPair;
    let deployment = pair.providerDeploymentVersion.deployment;
    let provider = deployment.provider;
    let config = pair.providerConfigVersion.config;
    let authConfig = pair.providerAuthConfigVersion?.authConfig;

    return {
      object: 'callback.instance' as const,
      id: callbackInstance.id,
      integration_instance_id: callbackInstance.integrationInstance.id,
      integration_instance_provider_id: callbackInstance.integrationInstanceProvider.id,
      status: callbackInstance.status,
      registration_status: callbackInstance.registrationStatus,
      registration_generation: callbackInstance.registrationGeneration,
      registration_transition_version: callbackInstance.registrationTransitionVersion,
      registration_error: callbackInstance.registrationErrorCode
        ? {
            code: callbackInstance.registrationErrorCode,
            message: callbackInstance.registrationErrorMessage,
            metadata: callbackInstance.registrationErrorMetadata,
            at: callbackInstance.registrationErrorAt
          }
        : null,
      last_registration_sync_error: callbackInstance.lastRegistrationSyncErrorCode
        ? {
            code: callbackInstance.lastRegistrationSyncErrorCode,
            message: callbackInstance.lastRegistrationSyncErrorMessage,
            at: callbackInstance.lastRegistrationSyncErrorAt
          }
        : null,
      verification_mechanism: callbackInstance.verificationMechanism,
      verification_spec_hash: callbackInstance.verificationSpecHash,

      deployment: await v1ProviderDeploymentPreviewPresenter
        .present(
          {
            deployment
          },
          opts
        )
        .run(),

      config: await v1ProviderConfigPreviewPresenter
        .present(
          {
            config: {
              ...config,
              provider
            }
          },
          opts
        )
        .run(),

      auth_config: authConfig
        ? await v1ProviderAuthConfigPreviewPresenter
            .present(
              {
                authConfig: {
                  ...authConfig,
                  providerId: provider.id
                }
              },
              opts
            )
            .run()
        : null,

      webhook_url: receiver?.receiverWebhookUrl ?? null,
      receiver_path_secret: receiver?.receiverPathSecret
        ? {
            object: 'callback.receiver_path_secret#metadata' as const,
            id: receiver.receiverPathSecret.id,
            generation: receiver.receiverPathSecret.generation,
            created_at: receiver.receiverPathSecret.createdAt,
            updated_at: receiver.receiverPathSecret.updatedAt
          }
        : null,

      triggers: await Promise.all(
        (receiver?.triggers ?? []).map(async trigger => ({
          object: 'callback.instance.trigger' as const,
          id: trigger.id,
          active: trigger.active,
          authoritative_state_version: trigger.authoritativeStateVersion,
          source: trigger.source,
          poll_interval_seconds: trigger.pollIntervalSeconds,
          next_poll_at: trigger.nextPollAt,
          last_polled_at: trigger.lastPolledAt,
          webhook_url: trigger.webhookUrl,
          is_webhook_registered: trigger.isWebhookRegistered,
          registration_status: trigger.registrationStatus,
          registration_generation: trigger.registrationGeneration,
          registration_transition_version: trigger.registrationTransitionVersion,
          registration_error: trigger.registrationError,
          verification_mechanism: trigger.verificationMechanism,
          verification_spec_hash: trigger.verificationSpecHash,
          provider_trigger: trigger.providerTrigger
            ? await v1ProviderTriggerPresenter
                .present(
                  {
                    trigger: {
                      id: trigger.providerTrigger.id,
                      key: trigger.providerTrigger.key,
                      name: trigger.providerTrigger.name,
                      description: trigger.providerTrigger.description,
                      inputJsonSchema: trigger.providerTrigger.value.inputJsonSchema,
                      outputJsonSchema: trigger.providerTrigger.value.outputJsonSchema ?? null,
                      eventTypes: trigger.providerTrigger.value.eventTypes ?? [],
                      invocation:
                        trigger.providerTrigger.value.invocation.type === 'polling'
                          ? {
                              type: 'polling',
                              intervalSeconds:
                                trigger.providerTrigger.value.invocation.intervalSeconds
                            }
                          : {
                              type: 'webhook',
                              autoRegistration: {
                                status: trigger.providerTrigger.value.invocation
                                  .autoRegistration
                                  ? 'supported'
                                  : 'unsupported'
                              },
                              autoUnregistration: {
                                status: trigger.providerTrigger.value.invocation
                                  .autoUnregistration
                                  ? 'supported'
                                  : 'unsupported'
                              }
                            },
                      providerId: trigger.providerTrigger.provider.id,
                      specificationId: trigger.providerTrigger.specification.id,
                      createdAt: trigger.providerTrigger.createdAt,
                      updatedAt: trigger.providerTrigger.updatedAt
                    }
                  },
                  opts
                )
                .run()
            : null
        }))
      ),

      created_at: callbackInstance.createdAt,
      updated_at: callbackInstance.updatedAt
    };
  })
  .schema(
    v.object({
      object: v.literal('callback.instance', {
        description: "String representing the object's type"
      }),
      id: v.string({
        name: 'id',
        description: 'Unique callback instance identifier',
        examples: ['cbi_5gHjKlMnPqRsTuVw']
      }),
      integration_instance_id: v.string({
        description: 'Integration instance represented by this callback instance'
      }),
      integration_instance_provider_id: v.string({
        description:
          'Configured integration instance provider represented by this callback instance'
      }),
      status: v.enumOf(['attached', 'detached'], {
        name: 'status',
        description:
          'Whether the callback instance is currently attached to a deployment/config pair'
      }),
      registration_status: registrationStatusSchema,
      registration_generation: v.number({ modifiers: [v.integer(), v.minValue(0)] }),
      registration_transition_version: v.number({
        modifiers: [v.integer(), v.minValue(0)]
      }),
      registration_error: registrationErrorSchema,
      last_registration_sync_error: v.nullable(
        v.object({
          code: v.string(),
          message: v.nullable(v.string()),
          at: v.nullable(v.date())
        })
      ),
      verification_mechanism: v.nullable(
        v.enumOf(['path_secret_only', 'hub', 'provider'] as const)
      ),
      verification_spec_hash: v.nullable(v.string()),
      deployment: v1ProviderDeploymentPreviewPresenter.schema,
      config: v1ProviderConfigPreviewPresenter.schema,
      auth_config: v.nullable(v1ProviderAuthConfigPreviewPresenter.schema),
      webhook_url: v.nullable(
        v.string({
          name: 'webhook_url',
          description:
            'Shared webhook URL for manual provider setup on this callback instance',
          examples: [
            'https://api.example.com/slates-hub/triggers/receiver-webhook/shtr_abc123'
          ]
        })
      ),
      receiver_path_secret: v.nullable(receiverPathSecretMetadataSchema),
      triggers: v.array(callbackInstanceTriggerSchema, {
        name: 'triggers',
        description: 'Resolved trigger registrations for this callback instance'
      }),
      created_at: v.date({
        name: 'created_at',
        description: 'Timestamp when the callback instance was created',
        examples: [new Date('2025-09-15T10:30:00Z')]
      }),
      updated_at: v.date({
        name: 'updated_at',
        description: 'Timestamp when the callback instance was last updated',
        examples: [new Date('2026-01-10T14:45:00Z')]
      })
    })
  )
  .build();

export let v1CallbackReceiverPathSecretPresenter = Presenter.create(
  callbackReceiverPathSecretType
)
  .presenter(async ({ receiverPathSecret }) => ({
    object: 'callback.receiver_path_secret' as const,
    id: receiverPathSecret.pathSecret.id,
    generation: receiverPathSecret.pathSecret.generation,
    value: receiverPathSecret.plaintext,
    ...(receiverPathSecret.webhookUrl ? { webhook_url: receiverPathSecret.webhookUrl } : {})
  }))
  .schema(
    v.object({
      object: v.literal('callback.receiver_path_secret'),
      id: v.string(),
      generation: v.number({ modifiers: [v.integer(), v.positive()] }),
      value: v.string({
        description:
          'Confidential receiver path value returned only by initial creation or rotation'
      }),
      webhook_url: v.optional(
        v.string({
          description: 'Receiver webhook URL containing the newly issued path value'
        })
      )
    })
  )
  .build();
