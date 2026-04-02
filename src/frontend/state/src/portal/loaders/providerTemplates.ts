import {
  DashboardInstanceProviderTemplatesCreateBody,
  DashboardInstanceProviderTemplatesListQuery,
  DashboardInstanceProviderTemplatesUpdateBody
} from '@metorial/dashboard-sdk';
import { createLoader } from '@metorial/data-hooks';
import { autoPaginate } from '../../lib/autoPaginate';
import { usePaginator } from '../../lib/usePaginator';
import { withAuth } from '../../user';

export let providerTemplatesLoader = createLoader({
  name: 'providerTemplates',
  parents: [],
  fetch: (i: { instanceId: string } & DashboardInstanceProviderTemplatesListQuery) =>
    withAuth(sdk => sdk.providerTemplates.list(i.instanceId, i)),
  mutators: {
    create: (body: DashboardInstanceProviderTemplatesCreateBody, { input: { instanceId } }) =>
      withAuth(sdk => sdk.providerTemplates.create(instanceId, body))
  }
});

export let useProviderTemplates = (
  instanceId: string | null | undefined,
  query?: DashboardInstanceProviderTemplatesListQuery
) => {
  let providerTemplates = usePaginator(
    pagination =>
      providerTemplatesLoader.use(
        instanceId ? { instanceId, ...pagination, ...query } : null
      ),
    instanceId ?? null
  );

  return {
    ...providerTemplates,
    createMutator: providerTemplates.useMutator('create')
  };
};

export let allProviderTemplatesLoader = createLoader({
  name: 'allProviderTemplates',
  parents: [],
  fetch: (
    i: {
      instanceId: string;
    } & Omit<DashboardInstanceProviderTemplatesListQuery, 'after' | 'before' | 'cursor'>
  ) =>
    withAuth(sdk =>
      autoPaginate(cursor =>
        sdk.providerTemplates.list(i.instanceId, {
          ...i,
          ...cursor,
          limit: i.limit ?? 100
        })
      )
    ),
  mutators: {}
});

export let useAllProviderTemplates = (
  instanceId: string | null | undefined,
  query?: Omit<DashboardInstanceProviderTemplatesListQuery, 'after' | 'before' | 'cursor'>
) => {
  return allProviderTemplatesLoader.use(instanceId ? { instanceId, ...query } : null);
};

export let useCreateProviderTemplate = providerTemplatesLoader.createExternalMutator(
  (i: DashboardInstanceProviderTemplatesCreateBody & { instanceId: string }) =>
    withAuth(sdk => sdk.providerTemplates.create(i.instanceId, i))
);

export let useUpdateProviderTemplate = providerTemplatesLoader.createExternalMutator(
  (i: {
    instanceId: string;
    providerTemplateId: string;
    body: DashboardInstanceProviderTemplatesUpdateBody;
  }) => withAuth(sdk => sdk.providerTemplates.update(i.instanceId, i.providerTemplateId, i.body))
);

export let useDeleteProviderTemplate = providerTemplatesLoader.createExternalMutator(
  (i: { instanceId: string; providerTemplateId: string }) =>
    withAuth(sdk => sdk.providerTemplates.delete(i.instanceId, i.providerTemplateId))
);
