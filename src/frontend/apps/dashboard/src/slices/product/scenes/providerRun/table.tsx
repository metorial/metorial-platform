import {
  DashboardInstanceProviderRunsGetOutput,
  DashboardInstanceProviderRunsListOutput,
  DashboardInstanceProviderRunsListQuery
} from '@metorial/dashboard-sdk';
import { renderWithLoader, renderWithPagination } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import { useAllProviderRuns, useCurrentInstance, useProviders } from '@metorial/state';
import { Badge, RenderDate, Text } from '@metorial/ui';
import { Table } from '@metorial/ui-product';
import { useMemo } from 'react';

type ProviderRun = DashboardInstanceProviderRunsListOutput['items'][number];
type ProviderRunStatusFilter = Extract<
  DashboardInstanceProviderRunsListQuery['status'],
  'running' | 'stopped'
>;
type ProviderRunStatusCarrier =
  | Pick<DashboardInstanceProviderRunsListOutput['items'][number], 'status'>
  | Pick<DashboardInstanceProviderRunsGetOutput, 'status'>;

let normalizeProviderRunStatus = (status?: string): ProviderRunStatusFilter | undefined => {
  if (status === 'running' || status === 'stopped') return status;
  return undefined;
};

export let ServerRunStatusBadge = ({ run }: { run: ProviderRunStatusCarrier }) => {
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
  let runs = useAllProviderRuns(instance.data?.id, {
    sessionId: filter?.sessionId,
    providerId: filter?.providerId,
    status: normalizeProviderRunStatus(filter?.status),
    order: 'desc'
  });
  let providerIds = useMemo(
    () => [...new Set((runs.data?.items ?? []).map(run => run.providerId).filter(Boolean))],
    [runs.data?.items]
  );
  let providers = useProviders(
    instance.data?.id,
    providerIds.length > 0 ? { id: providerIds } : null
  );

  let providerNameMap = useMemo(() => {
    let map = new Map<string, string>();
    if (providers.data) {
      for (let provider of providers.data.items) {
        map.set(provider.id, provider.name);
      }
    }
    return map;
  }, [providers.data]);

  let runsContent = renderWithPagination(runs)(runs => (
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

  return renderWithLoader({ providers })(() => runsContent);
};
