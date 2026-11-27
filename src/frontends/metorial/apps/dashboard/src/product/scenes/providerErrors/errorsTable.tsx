import { DashboardInstanceSessionsErrorsListQuery } from '@metorial/dashboard-sdk';
import { col, createDataList } from '@metorial/data-list';
import { useAllSessionErrors } from '@metorial/state';
import { Badge } from '@metorial/ui';
import { useInstanceContext } from '../../lib/dataList';

let ServerErrorsList = createDataList<{ query: DashboardInstanceSessionsErrorsListQuery }>(
  'server-errors'
)
  .context(useInstanceContext)
  .paginated(({ props, ctx }) => useAllSessionErrors(ctx.instanceId, props.query))
  .columns([
    col.custom({
      id: 'code',
      header: 'Type',
      render: error => <Badge color="red">{error.code ?? 'Unknown'}</Badge>
    }),
    col.text({
      id: 'message',
      header: 'Message',
      weight: 'strong',
      get: error => error.message ?? 'No message'
    }),
    col.text({
      id: 'providerRunId',
      header: 'Provider Run',
      get: error => error.providerRunId,
      fallback: 'N/A'
    }),
    col.createdAt({ header: 'Occurred At' }),
    col.id()
  ])
  .build();

export let ServerErrorsTable = (filter: DashboardInstanceSessionsErrorsListQuery) => (
  <ServerErrorsList
    query={filter}
    emptyState="No provider errors found."
    listVariant="embedded"
    hideToolbar
  />
);
