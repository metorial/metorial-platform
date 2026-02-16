import { DashboardInstanceProviderRunsListOutput } from '@metorial/dashboard-sdk/src/gen/src/mt_2026_02_01_dashboard';
import { renderWithPagination } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import { useCurrentInstance, useAllProviderRuns, useProviders } from '@metorial/state';
import { Badge, RenderDate, Text } from '@metorial/ui';
import { Table } from '@metorial/ui-product';
import { useMemo } from 'react';

type ProviderRun = DashboardInstanceProviderRunsListOutput['items'][number];

export let ServerRunStatusBadge = ({ run }: { run: ProviderRun | { status: string } }) => {
  let statusColorMap: Record<string, 'orange' | 'red' | 'blue' | 'green' | 'gray'> = {
    active: 'orange',
    running: 'orange',
    failed: 'red',
    completed: 'blue',
    stopped: 'gray',
    succeeded: 'green'
  };
  let statusLabelMap: Record<string, string> = {
    active: 'Running',
    running: 'Running',
    failed: 'Failed',
    completed: 'Completed',
    stopped: 'Stopped',
    succeeded: 'Succeeded'
  };
  return (
    <Badge color={statusColorMap[run.status ?? ''] ?? 'gray'}>
      {statusLabelMap[run.status ?? ''] ?? run.status}
    </Badge>
  );
};

export let ServerRunsTable = (filter?: {
  sessionId?: string;
  providerId?: string;
  status?: string;
}) => {
  let instance = useCurrentInstance();
  let runs = useAllProviderRuns(instance.data?.instanceId, {
    sessionId: filter?.sessionId,
    providerId: filter?.providerId,
    status: filter?.status,
    order: 'desc'
  });
  let providers = useProviders(instance.data?.instanceId);

  let providerNameMap = useMemo(() => {
    let map = new Map<string, string>();
    if (providers.data) {
      for (let provider of providers.data.items) {
        map.set(provider.id, provider.name);
      }
    }
    return map;
  }, [providers.data]);

  return renderWithPagination(runs)(runs => (
    <>
      <Table
        headers={['Status', 'Provider', 'Started', 'Stopped']}
        data={runs.data.items.map(run => ({
          data: [
            <ServerRunStatusBadge run={run} />,
            <Text size="2" weight="strong">
              {(run.providerId && providerNameMap.get(run.providerId)) ??
                run.providerId ??
                'Unknown'}
            </Text>,
            <RenderDate date={run.createdAt} />,
            <>
              {run.completedAt ? (
                <RenderDate date={run.completedAt} />
              ) : (
                <Text size="2" color="gray600">
                  Running
                </Text>
              )}
            </>
          ],
          href: Paths.instance.providerRun(
            instance.data?.organization,
            instance.data?.project,
            instance.data,
            run.id
          )
        }))}
      />

      {runs.data.items.length == 0 && (
        <Text size="2" color="gray600" align="center" style={{ marginTop: 10 }}>
          No provider runs found.
        </Text>
      )}
    </>
  ));
};
