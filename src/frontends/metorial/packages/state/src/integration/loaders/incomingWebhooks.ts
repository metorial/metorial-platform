import type {
  DashboardInstanceIncomingWebhooksListOutput,
  DashboardInstanceIncomingWebhooksListQuery
} from '@metorial/dashboard-sdk';
import { createLoader } from '@metorial/data-hooks';
import { usePaginator } from '../../lib/usePaginator';
import { withAuth } from '../../user';

export type IncomingWebhookPreview =
  DashboardInstanceIncomingWebhooksListOutput['items'][number];

export let incomingWebhooksLoader = createLoader({
  name: 'incomingWebhooks',
  parents: [],
  fetch: (i: { instanceId: string } & DashboardInstanceIncomingWebhooksListQuery) =>
    withAuth(sdk => {
      let { instanceId, ...query } = i;
      return sdk.callbacks.incomingWebhooks.list(instanceId, query);
    }),
  mutators: {}
});

export let useIncomingWebhooks = (
  instanceId: string | null | undefined,
  query?: DashboardInstanceIncomingWebhooksListQuery
) => {
  return usePaginator(pagination =>
    incomingWebhooksLoader.use(instanceId ? { instanceId, ...pagination, ...query } : null)
  );
};

export let incomingWebhookLoader = createLoader({
  name: 'incomingWebhook',
  parents: [incomingWebhooksLoader],
  fetch: (i: { instanceId: string; incomingWebhookId: string }) =>
    withAuth(sdk => sdk.callbacks.incomingWebhooks.get(i.instanceId, i.incomingWebhookId)),
  mutators: {}
});

export let useIncomingWebhook = (
  instanceId: string | null | undefined,
  incomingWebhookId: string | null | undefined
) =>
  incomingWebhookLoader.use(
    instanceId && incomingWebhookId ? { instanceId, incomingWebhookId } : null
  );
