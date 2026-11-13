import type {
  DashboardInstanceCustomProvidersGetOutput,
  DashboardInstanceCustomProvidersVersionsListQuery
} from '@metorial/dashboard-sdk';
import { col, createDataList, withDefaults } from '@metorial/data-list';
import { Paths } from '@metorial/frontend-config';
import { useCustomProviderVersions } from '@metorial/state';
import { useInstanceContext } from '../../lib/dataList';
import { CustomProviderVersionStatus } from './version';

export type CustomProviderVersionsFilters = Omit<
  DashboardInstanceCustomProvidersVersionsListQuery,
  'customProviderId' | 'after' | 'before' | 'cursor'
>;

export let CustomProviderVersionsTable = createDataList<{
  customProvider: DashboardInstanceCustomProvidersGetOutput | undefined | null;
  filters?: CustomProviderVersionsFilters;
}>('custom-provider-versions')
  .context(useInstanceContext)
  .paginated(({ props, ctx, limit }) =>
    useCustomProviderVersions(
      ctx.instanceId,
      props.customProvider?.id,
      withDefaults({ order: 'desc' as const, ...props.filters }, { limit })
    )
  )
  .columns([
    col.text({ id: 'version', header: 'Version', weight: 'strong', get: row => row.index }),
    col.custom({
      id: 'status',
      header: 'Status',
      render: row => <CustomProviderVersionStatus version={row} />
    }),
    col.createdAt(),
    col.id()
  ])
  .link((row, props, ctx) =>
    Paths.instance.customProvider(
      ctx.organization,
      ctx.project,
      ctx.instance,
      props.customProvider?.id,
      'versions',
      { version_id: row.id }
    )
  )
  .build();
