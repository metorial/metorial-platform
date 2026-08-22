export type CallbackLabel = {
  id: string;
  name: string;
  status: 'active' | 'archived' | 'deleted';
};

export type WebhookSource = {
  type: string;
  callbackId?: string | null;
  senderId?: string | null;
  senderIdentifier?: string | null;
  senderName?: string | null;
  sender_id?: string | null;
  sender_identifier?: string | null;
  sender_name?: string | null;
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

  if (source.type === 'sender') {
    let senderName = (source.senderName ?? source.sender_name)?.trim();
    let senderIdentifier = (
      source.senderIdentifier ?? source.sender_identifier
    )?.trim();
    let senderId = (source.senderId ?? source.sender_id)?.trim();
    let label =
      senderName && senderIdentifier && senderName !== senderIdentifier
        ? `${senderName} (${senderIdentifier})`
        : senderName || senderIdentifier || senderId || 'Unknown sender';

    return { label, archived: false };
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
