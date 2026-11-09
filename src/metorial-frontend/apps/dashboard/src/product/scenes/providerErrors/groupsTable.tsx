import { DashboardInstanceSessionsErrorGroupsListOutput } from '@metorial/dashboard-sdk';
import {
  col,
  createDataList,
  f,
  withDefaults,
  type TableLayoutProps
} from '@metorial/data-list';
import { Paths } from '@metorial/frontend-config';
import { useSessionErrorGroups } from '@metorial/state';
import { Badge } from '@metorial/ui';
import { useInstanceContext } from '../../lib/dataList';
import { entityFilters } from '../entityFilters';
import { getErrorLabel } from '../errorGroupLabel';

type ErrorGroup = DashboardInstanceSessionsErrorGroupsListOutput['items'][number];

type ErrorGroupsTableProps = { sessionId?: string; type?: string };

let errorTypes = [
  'message_processing_timeout',
  'message_processing_provider_error',
  'message_processing_system_error'
] as const;

type ErrorType = (typeof errorTypes)[number];

let truncate = (str: string, maxLength: number) =>
  str.length <= maxLength ? str : str.slice(0, maxLength) + '...';

let ProviderErrorGroupsList = createDataList<ErrorGroupsTableProps>('provider-error-groups')
  .context(useInstanceContext)
  .filters((_props, ctx) => ({
    type: f.select('type', 'Type', [
      { id: 'message_processing_timeout', label: 'Timeout' },
      { id: 'message_processing_provider_error', label: 'Provider Error' },
      { id: 'message_processing_system_error', label: 'System Error' }
    ]),
    sessionId: f.entity(entityFilters.session(ctx.instanceId)),
    providerId: f.entity(entityFilters.provider(ctx.instanceId))
  }))
  .search('Search by provider, deployment, error code or ID…')
  .paginated(({ props, ctx, filters, search }) =>
    useSessionErrorGroups(
      ctx.instanceId,
      withDefaults(
        {
          sessionId: props.sessionId,
          type: errorTypes.find(type => type === props.type)
        },
        { order: 'desc' as const, ...filters, search }
      )
    )
  )
  .columns([
    col.custom<ErrorGroup>({
      id: 'code',
      header: 'Name',
      render: error =>
        error.code ? (
          <Badge color="red">{getErrorLabel(error.code)}</Badge>
        ) : (
          <Badge color="gray">Unknown</Badge>
        )
    }),
    col.text<ErrorGroup>({
      id: 'message',
      header: 'Details',
      get: error => truncate(error.message, 100)
    }),
    col.text<ErrorGroup>({
      id: 'occurrenceCount',
      header: 'Occurrences',
      get: error => error.occurrenceCount
    }),
    col.createdAt(),
    col.id({ header: 'Error Group ID' }),
    col.refId('providerId', (error: ErrorGroup) => error.providerId, { header: 'Provider ID' })
  ])
  .link((error, _props, ctx) =>
    Paths.instance.providerError(ctx.organization, ctx.project, ctx.instance, error.id)
  )
  .build();

export let ProviderErrorGroupsTable = ({
  layout,
  ...filter
}: ErrorGroupsTableProps & { layout?: TableLayoutProps } = {}) => (
  <ProviderErrorGroupsList emptyState="No provider errors found." {...layout} {...filter} />
);
