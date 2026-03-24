import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { callbackType } from '../../types';
import { v1ProviderDeploymentPreviewPresenter } from './deploymentPreview';

let callbackTriggerSchema = v.object({
  object: v.literal('callback.provider_trigger'),
  id: v.string(),
  provider_trigger_id: v.string(),
  provider_trigger_key: v.string(),
  provider_trigger_name: v.string(),
  event_types: v.array(v.string()),
  created_at: v.date()
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
      object: v.literal('callback'),
      id: v.string(),
      status: v.enumOf(['active', 'archived', 'deleted']),
      name: v.string(),
      description: v.nullable(v.string()),
      metadata: v.nullable(v.record(v.any())),
      poll_interval_seconds_override: v.nullable(v.number()),
      provider_deployment: v1ProviderDeploymentPreviewPresenter.schema,
      provider_triggers: v.array(callbackTriggerSchema),
      created_at: v.date(),
      updated_at: v.date()
    })
  )
  .build();
