import {
  ServerRunsGetOutput,
  ServerRunsListQuery
} from '@metorial/dashboard-sdk/src/gen/src/mt_2025_01_01_dashboard';
import { renderWithPagination } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import { useCurrentInstance, useServerRuns } from '@metorial/state';
import { Badge, RenderDate, Text } from '@metorial/ui';
import { Table } from '@metorial/ui-product';

export let ServerRunStatusBadge = ({ run }: { run: ServerRunsGetOutput }) => {
  return (
    <Badge
      color={
        {
          active: 'orange' as const,
          failed: 'red' as const,
          completed: 'blue' as const
        }[run.status]
      }
    >
      {{
        active: 'Running',
        failed: 'Failed',
        completed: 'Completed'
      }[run.status] ?? run.status}
    </Badge>
  );
};

export let ServerRunsTable = (filter: ServerRunsListQuery) => {
  let instance = useCurrentInstance();
  let runs = useServerRuns(instance.data?.id, {
    ...filter,
    order: filter.order ?? 'desc'
  });

  return renderWithPagination(runs)(runs => (
    <>
      <Table
        headers={['Status', 'Server', 'Started', 'Stopped']}
        data={runs.data.items.map(run => ({
          data: [
            <ServerRunStatusBadge run={run} />,
            <Text size="2" weight="strong">
              {run.server.name}
            </Text>,
            <RenderDate date={run.createdAt} />,
            <>
              {run.stoppedAt ? (
                <RenderDate date={run.stoppedAt} />
              ) : (
                <Text size="2" color="gray600">
                  Running
                </Text>
              )}
              ,
            </>
          ],
          href: Paths.instance.serverRun(
            instance.data?.organization,
            instance.data?.project,
            instance.data,
            run.id
          )
        }))}
      />

      {runs.data.items.length == 0 && (
        <Text size="2" color="gray600" align="center" style={{ marginTop: 10 }}>
          No server runs found.
        </Text>
      )}
    </>
  ));
};
