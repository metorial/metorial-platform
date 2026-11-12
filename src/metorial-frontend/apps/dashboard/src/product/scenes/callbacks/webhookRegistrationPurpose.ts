export type WebhookRegistrationPurpose = 'webhook_receiver' | 'delivery_setup';

type ProviderTypeTriggers =
  | {
      status: 'enabled';
      // `purpose` stays optional until the dashboard SDK is regenerated with it.
      webhookRegistration: { status: 'supported' | 'unsupported'; purpose?: string | null };
    }
  | { status: 'disabled' };

export let getWebhookRegistrationPurpose = (
  triggers: ProviderTypeTriggers | null | undefined
): WebhookRegistrationPurpose | null => {
  if (triggers?.status !== 'enabled') return null;
  if (triggers.webhookRegistration.status !== 'supported') return null;

  return triggers.webhookRegistration.purpose === 'delivery_setup'
    ? 'delivery_setup'
    : 'webhook_receiver';
};

// Managed credentials are already set up, so their connections never show a registration.
export let getConnectionWebhookRegistrationPurpose = (d: {
  triggers: ProviderTypeTriggers | null | undefined;
  authCredentialsIsManaged: boolean;
}) => (d.authCredentialsIsManaged ? null : getWebhookRegistrationPurpose(d.triggers));

// A delivery setup only applies to some connections, so the provider panel must not ask for one.
export let providerNeedsWebhookReceiver = (
  triggers: ProviderTypeTriggers | null | undefined
) => getWebhookRegistrationPurpose(triggers) === 'webhook_receiver';

export let getDeliverySetupState = (registrations: { status: string }[]) => {
  if (registrations.some(registration => registration.status === 'active')) return 'complete';
  if (registrations.some(registration => registration.status === 'awaiting_setup')) {
    return 'pending';
  }

  return 'missing';
};

export let WEBHOOK_REGISTRATION_COPY: Record<
  WebhookRegistrationPurpose,
  {
    createButton: string;
    createTitle: (providerName: string) => string;
    createName: (providerName: string) => string;
    createIntro: string;
    createSubmit: string;

    boxTitle: string;
    boxDescription: (providerName: string) => string;
    emptyTitle: string;
    emptyText: (providerName: string) => string;
    tableHeaders: [string, string];
    activeBadge: string | null;

    urlTitle: string;
    urlDescription: string;
    urlMissing: string;
    setupIncomplete: string;
    eventsEmpty: string;

    settingsTitle: string;
    settingsDescription: string;
    deleteButton: string;
    deleteDescription: string;
    deleteConfirm: (name: string) => string;
  }
> = {
  webhook_receiver: {
    createButton: 'Create Webhook Receiver',
    createTitle: (providerName: string) => `Set Up ${providerName} Webhook Receiver`,
    createName: (providerName: string) => `${providerName} Webhook Receiver`,
    createIntro:
      'Metorial will create a secure receive URL, then guide you through adding it to the provider and saving any required verification values.',
    createSubmit: 'Create Webhook Receiver',

    boxTitle: 'Inbound Event Setup',
    boxDescription: (providerName: string) =>
      `Tool calls to ${providerName} work without this, but inbound events require a webhook receiver registered with the provider.`,
    emptyTitle: 'Action Required to Receive Events',
    emptyText: (providerName: string) =>
      `Create a receiver, add its secure URL in ${providerName}, then enter any verification values requested by the provider. Metorial will guide you through each step.`,
    tableHeaders: ['Receiver', 'Receive URL'],
    activeBadge: null,

    urlTitle: 'Receive URL',
    urlDescription: "Paste this URL into the provider's webhook settings.",
    urlMissing: 'This receiver does not have a URL yet. Complete setup to provision one.',
    setupIncomplete:
      'Finish the provider instructions to start receiving webhooks at this URL.',
    eventsEmpty: 'No inbound webhooks have been received on this receiver yet.',

    settingsTitle: 'Receiver Settings',
    settingsDescription: 'Modify the saved details for this webhook receiver.',
    deleteButton: 'Delete Receiver',
    deleteDescription:
      'Metorial tears down the receiver on the provider and stops accepting webhooks at this URL. This cannot be undone.',
    deleteConfirm: (name: string) => `Are you sure you want to delete ${name}?`
  },
  delivery_setup: {
    createButton: 'Set Up Delivery',
    createTitle: (providerName: string) => `Set Up ${providerName} Delivery`,
    createName: (providerName: string) => `${providerName} Delivery Setup`,
    createIntro:
      'Metorial will create a push endpoint, then guide you through connecting it to your own Google OAuth app.',
    createSubmit: 'Start Setup',

    boxTitle: 'Delivery Setup',
    boxDescription: () =>
      'This connection uses your own Google OAuth app, so event delivery needs a one-time setup.',
    emptyTitle: 'Delivery Is Not Set Up',
    emptyText: (providerName: string) =>
      `Create a push endpoint, connect it to your own Google OAuth app, then enter the values Metorial asks for. ${providerName} events arrive once the delivery setup is finished.`,
    tableHeaders: ['Delivery Setup', 'Push Endpoint'],
    activeBadge: 'Set Up',

    urlTitle: 'Push Endpoint',
    urlDescription:
      'Use this URL as the push endpoint and audience of your Pub/Sub subscription.',
    urlMissing:
      'This delivery setup does not have a push endpoint yet. Complete setup to provision one.',
    setupIncomplete:
      'Finish the setup steps to receive events for connections that use this Google OAuth app.',
    eventsEmpty: 'No deliveries have been received at this push endpoint yet.',

    settingsTitle: 'Delivery Setup',
    settingsDescription: 'Modify the saved details for this delivery setup.',
    deleteButton: 'Delete Delivery Setup',
    deleteDescription:
      'Metorial stops accepting deliveries at this push endpoint. This cannot be undone.',
    deleteConfirm: () =>
      'Events stop being delivered in real time for connections that use this Google OAuth app until a new setup is saved.'
  }
};
