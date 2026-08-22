export type CallbackLabel = {
  id: string;
  name: string;
  status: 'active' | 'archived' | 'deleted';
};

export type WebhookSource = {
  type: string;
  callbackId?: string | null;
};

export let getCallbackFilterItems = (callbacks: readonly CallbackLabel[]) => [
  { id: 'all', label: 'All callbacks' },
  ...callbacks.map(callback => ({
    id: callback.id,
    label: `${callback.name}${callback.status === 'archived' ? ' (archived)' : ''}`,
    disabled: callback.status === 'archived'
  }))
];

export let getWebhookSourceDisplay = (
  source: WebhookSource,
  callbacks: readonly CallbackLabel[]
) => {
  if (source.type === 'callback' && source.callbackId) {
    let callback = callbacks.find(candidate => candidate.id === source.callbackId);
    return {
      label: callback?.name ?? 'Unknown callback',
      archived: callback?.status === 'archived'
    };
  }

  return {
    label: source.type ? `${source.type} source` : 'Unknown source',
    archived: false
  };
};

export let getWebhookDestinationDisplay = (
  destination: { name: string; url: string } | null
) => ({
  name: destination?.name ?? 'Unknown destination',
  description: destination?.url ?? 'The destination is no longer available.'
});
