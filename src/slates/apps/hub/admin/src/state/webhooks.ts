import { createLoader } from '@metorial-io/data-hooks';
import { adminClient, withAuthRedirect } from '../hooks/client.js';
import { usePaginatedLoader } from './usePaginatedLoader.js';

export let webhooksLoader = createLoader({
  name: 'webhooks',
  fetch: (params: { after?: string; before?: string; slateIds?: string[] }) =>
    withAuthRedirect(() => adminClient.webhook.list(params)),
  mutators: {}
});

export let useWebhooks = (slateIds?: string[]) =>
  usePaginatedLoader(webhooksLoader, { slateIds });

export let webhookLoader = createLoader({
  name: 'webhook',
  fetch: (webhookRegistrationId: string) =>
    withAuthRedirect(() => adminClient.webhook.get({ webhookRegistrationId })),
  mutators: {},
  parents: [webhooksLoader]
});

export let useWebhook = (webhookRegistrationId: string | undefined) =>
  webhookLoader.use(webhookRegistrationId || null);

export let createGlobalWebhook = (input: {
  slateId: string;
  name: string;
  description?: string;
  metadata?: Record<string, any>;
  userConfig: Record<string, any>;
}) => withAuthRedirect(() => adminClient.webhook.create(input));

export let updateGlobalWebhook = (input: {
  webhookRegistrationId: string;
  name?: string;
  description?: string;
  metadata?: Record<string, any>;
}) => withAuthRedirect(() => adminClient.webhook.update(input));

export let deleteGlobalWebhook = (webhookRegistrationId: string) =>
  withAuthRedirect(() => adminClient.webhook.delete({ webhookRegistrationId }));
