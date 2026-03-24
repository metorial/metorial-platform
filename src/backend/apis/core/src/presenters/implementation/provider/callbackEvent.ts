import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { callbackEventType } from '../../types';

export let v1CallbackEventPresenter = Presenter.create(callbackEventType)
  .presenter(async ({ callbackEvent }) => ({
    object: 'callback.event' as const,
    id: callbackEvent.id,
    type: callbackEvent.type,
    source_id: callbackEvent.sourceId,
    trigger_key: callbackEvent.triggerKey,
    input: callbackEvent.input,
    output: callbackEvent.output,
    delivery_status: callbackEvent.deliveryStatus,
    callback_id: callbackEvent.callbackId,
    provider_deployment_config_pair_id: callbackEvent.providerDeploymentConfigPairId,
    callback_instance_id: callbackEvent.callbackInstanceId,
    created_at: callbackEvent.createdAt
  }))
  .schema(
    v.object({
      object: v.literal('callback.event'),
      id: v.string(),
      type: v.string(),
      source_id: v.string(),
      trigger_key: v.string(),
      input: v.record(v.any()),
      output: v.record(v.any()),
      delivery_status: v.string(),
      callback_id: v.string(),
      provider_deployment_config_pair_id: v.nullable(v.string()),
      callback_instance_id: v.nullable(v.string()),
      created_at: v.date()
    })
  )
  .build();
