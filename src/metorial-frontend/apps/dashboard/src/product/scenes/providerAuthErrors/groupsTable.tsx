import { DashboardInstanceProviderAuthConfigErrorsGroupsListOutput } from '@metorial/dashboard-sdk';
import {
  col,
  createDataList,
  f,
  withDefaults,
  type TableLayoutProps
} from '@metorial/data-list';
import { Paths } from '@metorial/frontend-config';
import { useProviderAuthConfigErrorGroups } from '@metorial/state';
import { Badge } from '@metorial/ui';
import { useInstanceContext } from '../../lib/dataList';
import { entityFilters } from '../entityFilters';
import { getErrorLabel } from '../errorGroupLabel';

type ErrorGroup = DashboardInstanceProviderAuthConfigErrorsGroupsListOutput['items'][number];

type ErrorGroupsTableProps = { providerAuthConfigId?: string; providerId?: string };

let truncate = (str: string, maxLength: number) =>
  str.length <= maxLength ? str : str.slice(0, maxLength) + '...';

let ProviderAuthErrorGroupsList = createDataList<ErrorGroupsTableProps>(
  'provider-auth-error-groups'
)
  .context(useInstanceContext)
  .filters((_props, ctx) => ({
    type: f.string('type', 'Type'),
    providerAuthConfigId: f.entity(entityFilters.providerAuthConfig(ctx.instanceId)),
    providerId: f.entity(entityFilters.provider(ctx.instanceId))
  }))
  .search('Search by provider, auth config, credentials or ID…')
  .paginated(({ props, ctx, filters, search }) =>
    useProviderAuthConfigErrorGroups(
      ctx.instanceId,
      withDefaults(
        { providerAuthConfigId: props.providerAuthConfigId, providerId: props.providerId },
        { order: 'desc' as const, ...filters, search }
      )
    )
  )
  .columns([
    col.custom<ErrorGroup>({
      id: 'code',
      header: 'Name',
      render: group =>
        group.code ? (
          <Badge color="red">{getErrorLabel(group.code)}</Badge>
        ) : (
          <Badge color="gray">Unknown</Badge>
        )
    }),
    col.text<ErrorGroup>({
      id: 'message',
      header: 'Details',
      get: group => truncate(group.message, 100)
    }),
    col.text<ErrorGroup>({
      id: 'occurrenceCount',
      header: 'Occurrences',
      get: group => group.occurrenceCount
    }),
    col.createdAt(),
    col.id({ header: 'Error Group ID' }),
    col.refId('providerId', (group: ErrorGroup) => group.providerId, { header: 'Provider ID' })
  ])
  .link((group, _props, ctx) =>
    Paths.instance.providerAuthError(ctx.organization, ctx.project, ctx.instance, group.id)
  )
  .build();

export let ProviderAuthErrorGroupsTable = ({
  layout,
  ...filter
}: ErrorGroupsTableProps & { layout?: TableLayoutProps } = {}) => (
  <ProviderAuthErrorGroupsList
    emptyState="No provider auth errors found."
    {...layout}
    {...filter}
  />
);
