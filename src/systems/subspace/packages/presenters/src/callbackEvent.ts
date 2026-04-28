type CallbackEvent = {
  id: string;
  externalId: string | null;
  type: string;
  sourceId: string;
  triggerKey: string | null;
  input: any;
  output: any;
  status: 'pending' | 'processing' | 'retrying' | 'succeeded' | 'failed' | 'skipped';
  error: {
    code: string | null;
    message: string | null;
  } | null;
  deliveryStatus: 'pending' | 'sent' | 'failed' | 'skipped';
  callbackId: string;
  providerDeploymentConfigPairId: string | null;
  callbackInstanceId: string | null;
  createdAt: Date;
};

export let callbackEventPresenter = (event: CallbackEvent) => ({
  object: 'callback.event',

  id: event.id,
  externalId: event.externalId,
  type: event.type,
  sourceId: event.sourceId,
  triggerKey: event.triggerKey,

  input: event.input,
  output: event.output,
  status: event.status,
  error: event.error,
  deliveryStatus: event.deliveryStatus,

  callbackId: event.callbackId,
  callbackInstanceId: event.callbackInstanceId,

  createdAt: event.createdAt
});

type CallbackEventListResult = {
  items: CallbackEvent[];
  pagination: {
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
};

export let callbackEventListPresenter = (result: CallbackEventListResult) => ({
  items: result.items.map(callbackEventPresenter),
  pagination: result.pagination
});
