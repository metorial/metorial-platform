import {
  col,
  createDataList,
  deleteAction,
  f,
  lifecycleStatusWithDraft,
  withDefaults
} from '@metorial/data-list';
import { Paths } from '@metorial/frontend-config';
import {
  useDeleteIntegrationInstance,
  useIntegrationInstances,
  type IntegrationInstance,
  type IntegrationPreview
} from '@metorial/state';
import type { ComponentProps } from 'react';
import { ResourceOwnerInline } from '../../components/resourceOwnerEntity';
import { useInstanceContext } from '../../lib/dataList';
import { entityFilters } from '../entityFilters';

let IntegrationInstancesList = createDataList<{
  instanceId?: string;
  integration: IntegrationPreview;
}>('integration-instances')
  .context(useInstanceContext)
  .filters((props, ctx) => ({
    status: f.status(lifecycleStatusWithDraft),
    identityId: f.entity(entityFilters.identity(props.instanceId ?? ctx.instanceId)),
    createdAt: f.createdAt(),
    updatedAt: f.updatedAt()
  }))
  .search('Search integration instances…')
  .paginated(({ props, ctx, filters, search, limit }) =>
    useIntegrationInstances(
      props.instanceId ?? ctx.instanceId,
      withDefaults(
        {
          ownership: 'all' as const,
          integrationId: props.integration.id,
          order: 'desc' as const,
          status: ['active' as const]
        },
        { ...filters, search, limit }
      )
    )
  )
  .columns([
    col.name<IntegrationInstance>({ description: false }),
    col.count<IntegrationInstance>('providers', row => row.providers?.length, 'provider', {
      header: 'Providers'
    }),
    col.status<IntegrationInstance, string>(lifecycleStatusWithDraft, { isDefault: false }),
    col.refId<IntegrationInstance>('identity', row => row.identityId, { header: 'Identity' }),
    col.custom<IntegrationInstance>({
      id: 'owner',
      header: 'Owner',
      render: row => <ResourceOwnerInline resource={row} linked={false} />
    }),
    col.createdAt(),
    col.updatedAt(),
    col.id({ isDefault: true })
  ])
  .link((row, _props, ctx) =>
    Paths.instance.integrationInstance(ctx.organization, ctx.project, ctx.instance, row.id)
  )
  .itemActions([
    deleteAction({
      noun: 'Instance',
      name: row => row.name,
      batchSize: 5,
      useMutate: () => useDeleteIntegrationInstance(),
      input: (row, { props, ctx }) => ({
        instanceId: props.instanceId ?? ctx.instanceId!,
        integrationInstanceId: row.id
      })
    })
  ])
  .build();

export let IntegrationInstancesTable = (
  p: ComponentProps<typeof IntegrationInstancesList>
) => (
  <IntegrationInstancesList
    emptyState="No instances have been created for this integration yet."
    {...p}
  />
);
