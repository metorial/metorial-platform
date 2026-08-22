import type {
  DashboardInstanceWebhooksDestinationsCreateBody,
  DashboardInstanceWebhooksDestinationsListQuery,
  DashboardInstanceWebhooksDestinationsUpdateBody
} from '@metorial/dashboard-sdk';
import { createLoader } from '@metorial/data-hooks';
import { allCallbacksLoader, callbacksLoader } from '../../callback/loaders/callbacks';
import { integrationProviderCallbackLoader } from '../../callback/loaders/integrationProviderCallback';
import { usePaginator } from '../../lib/usePaginator';
import { withAuth } from '../../user';

export let webhookDestinationsLoader = createLoader({
  name: 'webhookDestinations',
  parents: [callbacksLoader, allCallbacksLoader, integrationProviderCallbackLoader],
  fetch: (i: { instanceId: string } & DashboardInstanceWebhooksDestinationsListQuery) => {
    let { instanceId, ...query } = i;
    return withAuth(sdk => sdk.webhooks.destinations.list(instanceId, query));
  },
  mutators: {
    delete: (
      i: { webhookDestinationId: string },
      { input: { instanceId } }: { input: { instanceId: string } }
    ) => withAuth(sdk => sdk.webhooks.destinations.delete(instanceId, i.webhookDestinationId))
  }
});

export let useCreateWebhookDestination = webhookDestinationsLoader.createExternalMutator(
  (i: DashboardInstanceWebhooksDestinationsCreateBody & { instanceId: string }) => {
    let { instanceId, ...body } = i;
    return withAuth(sdk => sdk.webhooks.destinations.create(instanceId, body));
  }
);

export let useRotateWebhookDestinationSigningSecret =
  webhookDestinationsLoader.createExternalMutator(
    (i: { instanceId: string; webhookDestinationId: string }) =>
      withAuth(sdk =>
        sdk.webhooks.destinations.rotateSigningSecret(i.instanceId, i.webhookDestinationId)
      )
  );

export let useWebhookDestinations = (
  instanceId: string | null | undefined,
  query?: DashboardInstanceWebhooksDestinationsListQuery
) => {
  let data = usePaginator(
    pagination =>
      webhookDestinationsLoader.use(
        instanceId ? { instanceId, ...pagination, ...query } : null
      ),
    JSON.stringify(query ?? {})
  );

  return {
    ...data,
    useDeleteMutator: data.useMutator('delete')
  };
};

export let webhookDestinationLoader = createLoader({
  name: 'webhookDestination',
  parents: [
    webhookDestinationsLoader,
    callbacksLoader,
    allCallbacksLoader,
    integrationProviderCallbackLoader
  ],
  fetch: (i: { instanceId: string; webhookDestinationId: string }) =>
    withAuth(sdk => sdk.webhooks.destinations.get(i.instanceId, i.webhookDestinationId)),
  mutators: {
    update: (
      body: DashboardInstanceWebhooksDestinationsUpdateBody,
      { input: { instanceId, webhookDestinationId } }
    ) =>
      withAuth(sdk =>
        sdk.webhooks.destinations.update(instanceId, webhookDestinationId, body)
      ),
    delete: (_: void, { input: { instanceId, webhookDestinationId } }) =>
      withAuth(sdk => sdk.webhooks.destinations.delete(instanceId, webhookDestinationId))
  }
});

export let useWebhookDestination = (
  instanceId: string | null | undefined,
  webhookDestinationId: string | null | undefined
) => {
  let data = webhookDestinationLoader.use(
    instanceId && webhookDestinationId ? { instanceId, webhookDestinationId } : null
  );

  return {
    ...data,
    useUpdateMutator: data.useMutator('update'),
    useDeleteMutator: data.useMutator('delete')
  };
};
