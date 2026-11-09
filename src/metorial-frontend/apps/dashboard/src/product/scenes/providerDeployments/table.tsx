import {
  DashboardInstanceProviderDeploymentsListOutput,
  DashboardInstanceProviderDeploymentsListQuery
} from '@metorial/dashboard-sdk';
import {
  col,
  createDataList,
  deleteAction,
  f,
  lifecycleStatus,
  withDefaults,
  type DataListCommonProps
} from '@metorial/data-list';
import { Paths } from '@metorial/frontend-config';
import { useDeleteProviderDeployment, useProviderDeployments } from '@metorial/state';
import { Badge, Text } from '@metorial/ui';
import { useInstanceContext, withProviderNames } from '../../lib/dataList';
import { entityFilters } from '../entityFilters';

type ProviderDeployment = DashboardInstanceProviderDeploymentsListOutput['items'][number];

type ProviderDeploymentFilters = Omit<
  DashboardInstanceProviderDeploymentsListQuery,
  'limit' | 'after' | 'before' | 'cursor'
>;

let enrichProviderNames = withProviderNames<ProviderDeployment>(row => row.providerId);

export let ProviderDeploymentsList = createDataList<{
  instanceId?: string;
  providerId?: string;
  providerName?: string;
  filters?: ProviderDeploymentFilters;
}>('provider-deployments')
  .context(useInstanceContext)
  .filters((props, ctx) => {
    let instanceId = props.instanceId ?? ctx.instanceId;

    return {
      status: f.status(lifecycleStatus, { only: ['active', 'archived'] }),
      providerId: f.entity(entityFilters.provider(instanceId)),
      providerVersionId: f.entity(
        entityFilters.providerVersion(instanceId, { providerId: props.providerId })
      ),
      createdAt: f.createdAt(),
      updatedAt: f.updatedAt()
    };
  })
  .search('Search deployments…')
  .paginated(({ props, ctx, filters, search }) =>
    useProviderDeployments(
      props.instanceId ?? ctx.instanceId,
      withDefaults(
        {
          ...props.filters,
          providerId: props.providerId ?? props.filters?.providerId
        },
        {
          order: 'desc' as const,
          ...filters,
          search: search ?? props.filters?.search
        }
      )
    )
  )
  .enrich((items, args) => {
    let enriched = enrichProviderNames(items, args);
    let { providerId, providerName } = args.props;

    if (!providerId || !providerName) return enriched;

    return {
      ...enriched,
      items: enriched.items.map(row =>
        row.providerId === providerId ? { ...row, providerName } : row
      )
    };
  })
  .columns([
    col.name(),
    col.text({
      id: 'provider',
      header: 'Provider',
      get: row => row.providerName ?? row.providerId
    }),
    col.custom({
      id: 'version',
      header: 'Version',
      render: row =>
        row.lockedVersion ? (
          <Badge color="purple" size="2">
            {row.lockedVersion.version}
          </Badge>
        ) : (
          <Badge color="gray" size="2">
            Default
          </Badge>
        )
    }),
    col.createdAt(),
    col.id({ header: 'Deployment ID', isDefault: true }),
    col.status(lifecycleStatus, { isDefault: false }),
    col.custom({
      id: 'default',
      header: 'Default',
      isDefault: false,
      render: row =>
        row.isDefault ? (
          <Badge color="blue">Default</Badge>
        ) : (
          <Text size="2" color="gray600">
            No
          </Text>
        )
    }),
    col.updatedAt(),
    col.refId('providerId', row => row.providerId, { header: 'Provider ID' }),
    col.refId('providerVersionId', row => row.lockedVersion?.id, {
      header: 'Locked Version ID'
    }),
    col.refId('defaultConfig', row => row.defaultConfig?.id, { header: 'Default Config' })
  ])
  .link((row, _props, ctx) =>
    Paths.instance.providerDeployment(ctx.organization, ctx.project, ctx.instance, row.id)
  )
  .itemActions([
    deleteAction({
      noun: 'Deployment',
      name: row => row.name,
      disabled: row => row.status !== 'active',
      useMutate: () => useDeleteProviderDeployment(),
      input: (row, { props, ctx }) => ({
        instanceId: props.instanceId ?? ctx.instanceId,
        providerDeploymentId: row.id
      })
    })
  ])
  .build();

export type ProviderDeploymentsTableProps = {
  instanceId?: string;
  providerId?: string;
  providerName?: string;
  status?: string;
  search?: string;
} & DataListCommonProps<ProviderDeployment>;

export let ProviderDeploymentsTable = ({
  status,
  search,
  ...props
}: ProviderDeploymentsTableProps) => (
  <ProviderDeploymentsList
    emptyState="No deployments found."
    {...props}
    filters={{
      status: status === 'active' || status === 'archived' ? status : undefined,
      search
    }}
  />
);
