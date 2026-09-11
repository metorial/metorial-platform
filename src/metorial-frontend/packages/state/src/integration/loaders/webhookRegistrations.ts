import type {
  DashboardInstanceWebhookRegistrationsCreateBody,
  DashboardInstanceWebhookRegistrationsListOutput,
  DashboardInstanceWebhookRegistrationsListQuery,
  DashboardInstanceWebhookRegistrationsSetupBody,
  DashboardInstanceWebhookRegistrationsUpdateBody
} from '@metorial/dashboard-sdk';
import { createLoader } from '@metorial/data-hooks';
import { usePaginator } from '../../lib/usePaginator';
import { withAuth } from '../../user';

export type WebhookRegistrationPreview =
  DashboardInstanceWebhookRegistrationsListOutput['items'][number];

export let webhookRegistrationsLoader = createLoader({
  name: 'webhookRegistrations',
  parents: [],
  fetch: (i: { instanceId: string } & DashboardInstanceWebhookRegistrationsListQuery) =>
    withAuth(sdk => {
      let { instanceId, ...query } = i;
      return sdk.callbacks.registrations.list(instanceId, query);
    }),
  mutators: {}
});

export let useWebhookRegistrations = (
  instanceId: string | null | undefined,
  query?: DashboardInstanceWebhookRegistrationsListQuery
) => {
  return usePaginator(pagination =>
    webhookRegistrationsLoader.use(instanceId ? { instanceId, ...pagination, ...query } : null)
  );
};

export let webhookRegistrationLoader = createLoader({
  name: 'webhookRegistration',
  parents: [webhookRegistrationsLoader],
  fetch: (i: { instanceId: string; webhookRegistrationId: string }) =>
    withAuth(sdk => sdk.callbacks.registrations.get(i.instanceId, i.webhookRegistrationId)),
  mutators: {
    setup: (
      body: DashboardInstanceWebhookRegistrationsSetupBody,
      { input: { instanceId, webhookRegistrationId } }
    ) =>
      withAuth(sdk =>
        sdk.callbacks.registrations.setup(instanceId, webhookRegistrationId, body)
      ),
    update: (
      body: DashboardInstanceWebhookRegistrationsUpdateBody,
      { input: { instanceId, webhookRegistrationId } }
    ) =>
      withAuth(sdk =>
        sdk.callbacks.registrations.update(instanceId, webhookRegistrationId, body)
      ),
    delete: (_: {}, { input: { instanceId, webhookRegistrationId } }) =>
      withAuth(sdk => sdk.callbacks.registrations.delete(instanceId, webhookRegistrationId))
  }
});

export let useWebhookRegistration = (
  instanceId: string | null | undefined,
  webhookRegistrationId: string | null | undefined
) => {
  let data = webhookRegistrationLoader.use(
    instanceId && webhookRegistrationId ? { instanceId, webhookRegistrationId } : null
  );

  return {
    ...data,
    useSetupMutator: data.useMutator('setup'),
    useUpdateMutator: data.useMutator('update'),
    useDeleteMutator: data.useMutator('delete')
  };
};

export let useCreateWebhookRegistration = webhookRegistrationsLoader.createExternalMutator(
  (i: { instanceId: string } & DashboardInstanceWebhookRegistrationsCreateBody) =>
    withAuth(sdk => sdk.callbacks.registrations.create(i.instanceId, i)),
  { disableToast: true }
);

export let useSetupWebhookRegistration = webhookRegistrationsLoader.createExternalMutator(
  (
    i: {
      instanceId: string;
      webhookRegistrationId: string;
    } & DashboardInstanceWebhookRegistrationsSetupBody
  ) =>
    withAuth(sdk =>
      sdk.callbacks.registrations.setup(i.instanceId, i.webhookRegistrationId, i)
    ),
  { disableToast: true }
);

export let useDeleteWebhookRegistration = webhookRegistrationsLoader.createExternalMutator(
  (i: { instanceId: string; webhookRegistrationId: string }) =>
    withAuth(sdk => sdk.callbacks.registrations.delete(i.instanceId, i.webhookRegistrationId))
);
