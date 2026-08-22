import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { callbackType } from '../../../types';
import { v1WebhookDestinationPresenter } from '../webhooks/webhookDestination';
import { v1ProviderDeploymentPreviewPresenter } from '../config/deploymentPreview';

let callbackTriggerSchema = v.object({
  object: v.literal('callback.provider_trigger', {
    description: "String representing the object's type"
  }),
  id: v.string({
    name: 'id',
    description: 'Unique callback trigger association identifier',
    examples: ['cbt_4dEfGhJkLmNpQrSt']
  }),
  provider_trigger: v.object(
    {
      object: v.literal('provider.trigger#preview', {
        description: "String representing the provider trigger's type"
      }),

      id: v.string({
        name: 'id',
        description: 'Provider trigger identifier from the deployment specification',
        examples: ['ptr_7dEfGhJkLmNpQrSt']
      }),
      key: v.string({
        name: 'key',
        description: 'Stable trigger key used by the provider',
        examples: ['messages.created']
      }),
      name: v.string({
        name: 'name',
        description: 'Human-readable trigger name',
        examples: ['Messages Created']
      })
    },
    {
      name: 'provider_trigger',
      description: 'Preview of the provider trigger associated with this callback trigger'
    }
  ),
  event_types: v.array(
    v.string({
      examples: ['message.created']
    }),
    {
      name: 'event_types',
      description: 'Provider-specific event types enabled for this trigger'
    }
  ),
  created_at: v.date({
    name: 'created_at',
    description: 'Timestamp when this trigger was attached to the callback',
    examples: [new Date('2025-09-15T10:30:00Z')]
  })
});

export let v1CallbackPresenter = Presenter.create(callbackType)
  .presenter(async ({ callback }, opts) => {
    return {
      object: 'callback' as const,

      id: callback.id,
      integration_id: callback.integration.id,
      integration_provider_id: callback.integrationProvider.id,
      status: callback.status,
      name: callback.name,
      description: callback.description,
      metadata: callback.metadata,
      poll_interval_seconds_override: callback.pollIntervalSecondsOverride,

      config:
        callback.callbackConfig?.status === 'active' && callback.callbackConfig.currentVersion
          ? {
              object: 'callback.config' as const,
              id: callback.callbackConfig.id,
              configured_keys: callback.callbackConfig.currentVersion.configuredKeys,
              created_at: callback.callbackConfig.createdAt
            }
          : null,

      provider_deployment: await v1ProviderDeploymentPreviewPresenter
        .present(
          {
            deployment: callback.providerDeployment
          },
          opts
        )
        .run(),

      destinations: await Promise.all(
        callback.callbackDestinationLinks.map(async link =>
          v1WebhookDestinationPresenter
            .present({ webhookDestination: link.callbackDestination }, opts)
            .run()
        )
      ),

      provider_triggers: callback.callbackProviderTriggers.map(trigger => ({
        object: 'callback.provider_trigger' as const,
        id: trigger.id,

        event_types: trigger.eventTypes,
        created_at: trigger.createdAt,

        provider_trigger: {
          object: 'provider.trigger#preview' as const,

          id: trigger.providerTrigger.id,
          key: trigger.providerTrigger.key,
          name: trigger.providerTrigger.name
        }
      })),

      created_at: callback.createdAt,
      updated_at: callback.updatedAt
    };
  })
  .schema(
    v.object({
      object: v.literal('callback', {
        description: "String representing the object's type"
      }),
      id: v.string({
        name: 'id',
        description: 'Unique callback identifier',
        examples: ['clb_4dEfGhJkLmNpQrSt']
      }),
      integration_id: v.string({
        name: 'integration_id',
        description: 'Integration that owns this callback',
        examples: ['int_4dEfGhJkLmNpQrSt']
      }),
      integration_provider_id: v.string({
        name: 'integration_provider_id',
        description: 'Integration provider that owns this callback',
        examples: ['intp_4dEfGhJkLmNpQrSt']
      }),
      status: v.enumOf(['active', 'archived', 'deleted'], {
        name: 'status',
        description: 'Callback lifecycle status'
      }),
      name: v.string({
        name: 'name',
        description: 'Display name for the callback',
        examples: ['Production Webhook Callback']
      }),
      description: v.nullable(
        v.string({
          name: 'description',
          description: 'Optional callback description',
          examples: ['Sends provider trigger deliveries to our production webhook endpoint']
        })
      ),
      metadata: v.nullable(
        v.record(v.any(), {
          name: 'metadata',
          description: 'Custom key-value pairs for storing additional callback metadata',
          examples: [{ environment: 'production', owner: 'platform-team' }]
        })
      ),
      poll_interval_seconds_override: v.nullable(
        v.number({
          name: 'poll_interval_seconds_override',
          description:
            'Optional polling interval override, in seconds, for polling-capable triggers',
          examples: [60]
        })
      ),
      config: v.nullable(
        v.object({
          object: v.literal('callback.config', {
            description: "String representing the object's type"
          }),
          id: v.string({
            name: 'id',
            description: 'Stable callback config identifier'
          }),
          configured_keys: v.array(v.string(), {
            name: 'configured_keys',
            description: 'Names of callback config keys that have values'
          }),
          created_at: v.date({
            name: 'created_at',
            description: 'Timestamp when the callback config was created'
          })
        })
      ),
      provider_deployment: v1ProviderDeploymentPreviewPresenter.schema,
      destinations: v.array(v1WebhookDestinationPresenter.schema, {
        name: 'destinations',
        description: 'Destinations currently attached to this callback'
      }),
      provider_triggers: v.array(callbackTriggerSchema, {
        name: 'provider_triggers',
        description: 'Triggers configured on this callback'
      }),
      created_at: v.date({
        name: 'created_at',
        description: 'Timestamp when the callback was created',
        examples: [new Date('2025-09-15T10:30:00Z')]
      }),
      updated_at: v.date({
        name: 'updated_at',
        description: 'Timestamp when the callback was last updated',
        examples: [new Date('2026-01-10T14:45:00Z')]
      })
    })
  )
  .build();
