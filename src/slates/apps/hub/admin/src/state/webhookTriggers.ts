import { createLoader } from '@metorial-io/data-hooks';
import { adminClient, withAuthRedirect } from '../hooks/client.js';
import { usePaginatedLoader } from './usePaginatedLoader.js';

export type WebhookTriggerType = 'automated' | 'manual';
export type WebhookTriggerOwner = 'tenant' | 'global';

export let webhookTriggersLoader = createLoader({
  name: 'webhookTriggers',
  fetch: (params: {
    after?: string;
    before?: string;
    search?: string;
    types?: WebhookTriggerType[];
    owners?: WebhookTriggerOwner[];
  }) => withAuthRedirect(() => adminClient.devWebhookTrigger.list(params)),
  mutators: {}
});

export let useWebhookTriggers = (params?: {
  search?: string;
  types?: WebhookTriggerType[];
  owners?: WebhookTriggerOwner[];
}) => usePaginatedLoader(webhookTriggersLoader, params ?? {});

export let webhookTriggerLoader = createLoader({
  name: 'webhookTrigger',
  fetch: (webhookRegistrationId: string) =>
    withAuthRedirect(() => adminClient.devWebhookTrigger.get({ webhookRegistrationId })),
  mutators: {
    sendEvent: (
      body: {
        method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';
        path?: string;
        headers?: Record<string, string>;
        body?: string;
        useLocalhostUrl?: boolean;
      },
      { input }: { input: string }
    ) =>
      withAuthRedirect(() =>
        adminClient.devWebhookTrigger.sendEvent({
          webhookRegistrationId: input,
          ...body
        })
      )
  },
  parents: [webhookTriggersLoader]
});

export let useWebhookTrigger = (webhookRegistrationId: string | undefined) => {
  let data = webhookTriggerLoader.use(webhookRegistrationId || null);

  return {
    ...data,
    useSendEventMutator: data.useMutator('sendEvent')
  };
};

export let webhookTriggerEventsLoader = createLoader({
  name: 'webhookTriggerEvents',
  fetch: (params: { webhookRegistrationId: string; after?: string; before?: string }) =>
    withAuthRedirect(() => adminClient.devWebhookTrigger.listEvents(params)),
  mutators: {},
  parents: [webhookTriggerLoader]
});

export let useWebhookTriggerEvents = (webhookRegistrationId: string | undefined) =>
  usePaginatedLoader(
    webhookTriggerEventsLoader,
    webhookRegistrationId ? { webhookRegistrationId } : null
  );
