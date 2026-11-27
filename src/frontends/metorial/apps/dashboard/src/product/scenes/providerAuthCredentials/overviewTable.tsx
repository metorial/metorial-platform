import {
  DashboardInstanceProviderDeploymentsAuthCredentialsListOutput,
  DashboardInstanceProviderDeploymentsAuthCredentialsListQuery
} from '@metorial/dashboard-sdk';
import {
  col,
  createDataList,
  deleteAction,
  EmptyValue,
  f,
  lifecycleStatus,
  withDefaults
} from '@metorial/data-list';
import { Paths } from '@metorial/frontend-config';
import { useDeleteProviderAuthCredentials, useProviderAuthCredentials } from '@metorial/state';
import { Badge, Text } from '@metorial/ui';
import { useInstanceContext, withProviderNames } from '../../lib/dataList';
import { entityFilters } from '../entityFilters';

type ProviderAuthCredential =
  DashboardInstanceProviderDeploymentsAuthCredentialsListOutput['items'][number];

export type ProviderAuthCredentialFilters = Omit<
  DashboardInstanceProviderDeploymentsAuthCredentialsListQuery,
  'limit' | 'after' | 'before' | 'cursor'
>;

export let ProviderAuthCredentialsOverviewTable = createDataList<{
  instanceId?: string;
  filters?: ProviderAuthCredentialFilters;
}>('provider-auth-credentials-overview')
  .context(useInstanceContext)
  .filters((props, ctx) => {
    let instanceId = props.instanceId ?? ctx.instanceId;

    return {
      status: f.status(lifecycleStatus, { only: ['active', 'archived'] }),
      providerId: f.entity(entityFilters.provider(instanceId)),
      origin: f.select('origin', 'Origin', [
        { id: 'custom', label: 'Custom' },
        { id: 'managed', label: 'Managed' }
      ]),
      createdAt: f.createdAt(),
      updatedAt: f.updatedAt()
    };
  })
  .search('Search auth credentials…')
  .paginated(({ props, ctx, filters, search }) =>
    useProviderAuthCredentials(
      props.instanceId ?? ctx.instanceId,
      withDefaults(props.filters, {
        order: 'desc' as const,
        ...filters,
        search: search ?? props.filters?.search
      })
    )
  )
  .enrich(withProviderNames(row => row.providerId))
  .columns([
    col.custom({
      id: 'name',
      header: 'Name',
      render: row => (
        <Text
          size="2"
          weight="strong"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}
        >
          {row.isManaged && (
            <Badge color="blue" size="2">
              Managed
            </Badge>
          )}
          {row.name || <EmptyValue />}
        </Text>
      )
    }),
    col.text({
      id: 'provider',
      header: 'Provider',
      get: row => row.providerName ?? row.providerId
    }),
    col.text({ id: 'type', header: 'Type', get: row => row.type }),
    col.createdAt(),
    col.id({ isDefault: true }),
    col.status(lifecycleStatus, { isDefault: false }),
    col.text({
      id: 'origin',
      header: 'Origin',
      isDefault: false,
      get: row => (row.isManaged ? 'Managed' : 'Custom')
    }),
    col.updatedAt(),
    col.refId('providerId', row => row.providerId, { header: 'Provider ID' })
  ])
  .link((row, _props, ctx) =>
    Paths.organization.instance.providerAuthCredential(
      ctx.organization,
      ctx.project,
      ctx.instance,
      row.id
    )
  )
  .itemActions([
    deleteAction<ProviderAuthCredential & { providerName?: string | null }>({
      noun: 'Auth Credentials',
      name: row => row.name,
      disabled: row => row.status !== 'active' || row.isManaged,
      useMutate: () => useDeleteProviderAuthCredentials(),
      input: (row, { props, ctx }) => ({
        instanceId: props.instanceId ?? ctx.instanceId,
        providerAuthCredentialsId: row.id
      })
    })
  ])
  .build();
