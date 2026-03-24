import type { createSlatesHubInternalClient } from '@metorial-services/slates-hub-client';

type SlatesClient = ReturnType<typeof createSlatesHubInternalClient>;

type SlatesEvent = Awaited<ReturnType<SlatesClient['slateTriggerEvent']['get']>>;

type CallbackEvent = SlatesEvent & {
  callbackId: string;
  providerDeploymentConfigPairId: string | null;
  callbackInstanceId: string | null;
};

export let callbackEventPresenter = (event: CallbackEvent) => ({
  object: 'callback.event',

  id: event.id,
  type: event.type,
  sourceId: event.sourceId,
  triggerKey: event.triggerKey,

  input: event.input,
  output: event.output,
  deliveryStatus: event.deliveryStatus,

  callbackId: event.callbackId,
  providerDeploymentConfigPairId: event.providerDeploymentConfigPairId,
  callbackInstanceId: event.callbackInstanceId,

  createdAt: event.createdAt
});

type CallbackEventListResult = Awaited<
  ReturnType<SlatesClient['slateTriggerEvent']['list']>
> & {
  items: CallbackEvent[];
};

export let callbackEventListPresenter = (result: CallbackEventListResult) => ({
  items: result.items.map(callbackEventPresenter),
  pagination: result.pagination
});
