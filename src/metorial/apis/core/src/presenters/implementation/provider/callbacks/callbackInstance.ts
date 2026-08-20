import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import {
  callbackInstanceType,
  callbackSecretBulkRevocationType,
  callbackSecretConsumptionType,
  callbackSecretMutationType
} from '../../../types';
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
    code: v.enumOf([
      'provider_rejected',
      'provider_timeout',
      'provider_transport_error',
      'invalid_provider_result',
      'registration_capability_unavailable',
      'cleanup_failed',
      'registration_capture_conflict'
    ] as const),
    message: v.nullable(v.string()),
    metadata: v.nullable(v.record(v.any())),
    at: v.nullable(v.date())
  })
);

let callbackInstanceTriggerSchema = v.object({
  object: v.literal('callback.instance.trigger', {
    description: "String representing the object's type"
  }),
  id: v.string({
    name: 'id',
    description: 'Unique receiver trigger identifier',
    examples: ['ctr_9gHjKlMnPqRsTuVw']
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
  registration_generation: v.number(),
  registration_transition_version: v.number(),
  registration_error: registrationErrorSchema,
  verification_mechanism: v.enumOf(['path_secret_only', 'hub', 'provider'] as const),
  verification_spec_hash: v.nullable(v.string()),
  provider_trigger: v.nullable(v1ProviderTriggerPresenter.schema)
});

export let v1CallbackInstancePresenter = Presenter.create(callbackInstanceType)
  .presenter(async ({ callbackInstance }, opts) => ({
    object: 'callback.instance' as const,
    id: callbackInstance.id,
    status: callbackInstance.status,
    registration_status: callbackInstance.registrationStatus,
    registration_generation: callbackInstance.registrationGeneration,
    registration_transition_version: callbackInstance.registrationTransitionVersion,
    registration_error: callbackInstance.registrationError,
    last_registration_sync_error: callbackInstance.lastRegistrationSyncError,
    verification_mechanism: callbackInstance.verificationMechanism,
    verification_spec_hash: callbackInstance.verificationSpecHash,

    deployment: await v1ProviderDeploymentPreviewPresenter
      .present({ deployment: callbackInstance.deployment }, opts)
      .run(),

    config: await v1ProviderConfigPreviewPresenter
      .present({ config: callbackInstance.config }, opts)
      .run(),

    auth_config: callbackInstance.authConfig
      ? await v1ProviderAuthConfigPreviewPresenter
          .present({ authConfig: callbackInstance.authConfig }, opts)
          .run()
      : null,

    security: {
      receiver_id: callbackInstance.security.receiverId,
      receiver_url: callbackInstance.security.receiverUrl,
      path_secrets: callbackInstance.security.pathSecrets.map(secret => ({
        id: secret.id,
        status: secret.status,
        secret_version: secret.secretVersion,
        valid_from: secret.validFrom,
        valid_until: secret.validUntil,
        rotated_at: secret.rotatedAt
      })),
      provisioned_apps: callbackInstance.security.provisionedApps.map(app => ({
        id: app.id,
        generation: app.generation,
        vendor: app.vendor,
        credential_owner_type: app.credentialOwnerType,
        status: app.status,
        external_app_id: app.externalAppId,
        github_manifest_state_expires_at: app.githubManifestStateExpiresAt,
        github_manifest_completed_at: app.githubManifestCompletedAt,
        github_installation_completed_at: app.githubInstallationCompletedAt
      }))
    },

    triggers: await Promise.all(
      callbackInstance.triggers.map(async trigger => ({
        object: 'callback.instance.trigger' as const,
        id: trigger.id,
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
              .present({ trigger: trigger.providerTrigger }, opts)
              .run()
          : null
      }))
    ),

    created_at: callbackInstance.createdAt,
    updated_at: callbackInstance.updatedAt
  }))
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
      status: v.enumOf(['attached', 'detached'], {
        name: 'status',
        description:
          'Whether the callback instance is currently attached to a deployment/config pair'
      }),
      registration_status: registrationStatusSchema,
      registration_generation: v.number(),
      registration_transition_version: v.number(),
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
      security: v.object({
        receiver_id: v.nullable(v.string()),
        receiver_url: v.nullable(v.string()),
        path_secrets: v.array(
          v.object({
            id: v.string(),
            status: v.enumOf(['active', 'retiring'] as const),
            secret_version: v.number(),
            valid_from: v.date(),
            valid_until: v.nullable(v.date()),
            rotated_at: v.nullable(v.date())
          })
        ),
        provisioned_apps: v.array(
          v.object({
            id: v.string(),
            generation: v.number(),
            vendor: v.string(),
            credential_owner_type: v.enumOf(['managed', 'byo'] as const),
            status: v.string(),
            external_app_id: v.nullable(v.string()),
            github_manifest_state_expires_at: v.nullable(v.date()),
            github_manifest_completed_at: v.nullable(v.date()),
            github_installation_completed_at: v.nullable(v.date())
          })
        )
      }),
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

export let v1CallbackSecretMutationPresenter = Presenter.create(callbackSecretMutationType)
  .presenter(async ({ callbackSecretMutation }) => ({
    object: 'callback.secret_mutation' as const,
    audit_correlation_id: callbackSecretMutation.auditCorrelationId,
    secret: {
      id: callbackSecretMutation.secret.id,
      status: callbackSecretMutation.secret.status,
      secret_version: callbackSecretMutation.secret.secretVersion,
      valid_from: callbackSecretMutation.secret.validFrom,
      valid_until: callbackSecretMutation.secret.validUntil
    },
    secret_issuance_receipt: callbackSecretMutation.secretIssuanceReceipt
      ? {
          id: callbackSecretMutation.secretIssuanceReceipt.id,
          token: callbackSecretMutation.secretIssuanceReceipt.token,
          expires_at: callbackSecretMutation.secretIssuanceReceipt.expiresAt
        }
      : null,
    grace_expires_at: callbackSecretMutation.graceExpiresAt ?? null
  }))
  .schema(
    v.object({
      object: v.literal('callback.secret_mutation'),
      audit_correlation_id: v.string(),
      secret: v.object({
        id: v.string(),
        status: v.enumOf(['active', 'retiring', 'revoked'] as const),
        secret_version: v.number(),
        valid_from: v.date(),
        valid_until: v.nullable(v.date())
      }),
      secret_issuance_receipt: v.nullable(
        v.object({
          id: v.string(),
          token: v.string(),
          expires_at: v.date()
        })
      ),
      grace_expires_at: v.nullable(v.date())
    })
  )
  .build();

export let v1CallbackSecretBulkRevocationPresenter = Presenter.create(
  callbackSecretBulkRevocationType
)
  .presenter(async ({ callbackSecretBulkRevocation }) => ({
    object: 'callback.secret_bulk_revocation' as const,
    audit_correlation_id: callbackSecretBulkRevocation.auditCorrelationId,
    revoked_count: callbackSecretBulkRevocation.revokedCount,
    secrets: callbackSecretBulkRevocation.secrets.map(secret => ({
      id: secret.id,
      status: secret.status,
      secret_version: secret.secretVersion,
      valid_from: secret.validFrom,
      valid_until: secret.validUntil
    }))
  }))
  .schema(
    v.object({
      object: v.literal('callback.secret_bulk_revocation'),
      audit_correlation_id: v.string(),
      revoked_count: v.number({
        description: 'How many active or retiring secrets were revoked by this call'
      }),
      secrets: v.array(
        v.object({
          id: v.string(),
          status: v.enumOf(['active', 'retiring', 'revoked'] as const),
          secret_version: v.number(),
          valid_from: v.date(),
          valid_until: v.nullable(v.date())
        })
      )
    })
  )
  .build();

export let v1CallbackSecretConsumptionPresenter = Presenter.create(
  callbackSecretConsumptionType
)
  .presenter(async ({ callbackSecretConsumption }) => ({
    object: 'callback.secret_consumption' as const,
    audit_correlation_id: callbackSecretConsumption.auditCorrelationId,
    value: callbackSecretConsumption.plaintext
  }))
  .schema(
    v.object({
      object: v.literal('callback.secret_consumption'),
      audit_correlation_id: v.string(),
      value: v.string()
    })
  )
  .build();
