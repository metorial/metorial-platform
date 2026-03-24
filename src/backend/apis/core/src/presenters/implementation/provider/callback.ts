import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { callbackType } from '../../types';
import { v1ProviderDeploymentPreviewPresenter } from './deploymentPreview';

let callbackTriggerSchema = v.object({
  object: v.literal('callback.provider_trigger', {
    description: "String representing the object's type"
  }),
  id: v.string({
    name: 'id',
    description: 'Unique callback trigger association identifier',
    examples: ['cbt_4dEfGhJkLmNpQrSt']
  }),
  provider_trigger_id: v.string({
    name: 'provider_trigger_id',
    description: 'Provider trigger identifier from the deployment specification',
    examples: ['ptr_7dEfGhJkLmNpQrSt']
  }),
  provider_trigger_key: v.string({
    name: 'provider_trigger_key',
    description: 'Stable trigger key used by the provider',
    examples: ['messages.created']
  }),
  provider_trigger_name: v.string({
    name: 'provider_trigger_name',
    description: 'Human-readable trigger name',
    examples: ['Messages Created']
  }),
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
  .presenter(async ({ callback }, opts) => ({
    object: 'callback' as const,
    id: callback.id,
    status: callback.status,
    name: callback.name,
    description: callback.description,
    metadata: callback.metadata,
    poll_interval_seconds_override: callback.pollIntervalSecondsOverride,
    provider_deployment: await v1ProviderDeploymentPreviewPresenter
      .present({ deployment: callback.providerDeployment }, opts)
      .run(),
    provider_triggers: callback.providerTriggers.map(trigger => ({
      object: 'callback.provider_trigger' as const,
      id: trigger.id,
      provider_trigger_id: trigger.providerTriggerId,
      provider_trigger_key: trigger.providerTriggerKey,
      provider_trigger_name: trigger.providerTriggerName,
      event_types: trigger.eventTypes,
      created_at: trigger.createdAt
    })),
    created_at: callback.createdAt,
    updated_at: callback.updatedAt
  }))
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
          description: 'Optional polling interval override, in seconds, for polling-capable triggers',
          examples: [60]
        })
      ),
      provider_deployment: v1ProviderDeploymentPreviewPresenter.schema,
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
