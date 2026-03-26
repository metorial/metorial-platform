import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { callbackInstanceType } from '../../types';
import { v1ProviderAuthConfigPreviewPresenter } from './authConfigPreview';
import { v1ProviderConfigPreviewPresenter } from './configPreview';
import { v1ProviderDeploymentPreviewPresenter } from './deploymentPreview';
import { v1ProviderTriggerPresenter } from './providerTrigger';

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
  provider_trigger: v.nullable(v1ProviderTriggerPresenter.schema)
});

export let v1CallbackInstancePresenter = Presenter.create(callbackInstanceType)
  .presenter(async ({ callbackInstance }, opts) => ({
    object: 'callback.instance' as const,
    id: callbackInstance.id,
    status: callbackInstance.status,

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
      deployment: v1ProviderDeploymentPreviewPresenter.schema,
      config: v1ProviderConfigPreviewPresenter.schema,
      auth_config: v.nullable(v1ProviderAuthConfigPreviewPresenter.schema),
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
