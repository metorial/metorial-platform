import type {
  DashboardInstanceSkillsSyncsGetOutput,
  DashboardInstanceSkillsSyncsListQuery
} from '@metorial/dashboard-sdk';
import { renderWithLoader, renderWithPagination } from '@metorial/data-hooks';
import { useCurrentInstance, useSkillSync, useSkillSyncs } from '@metorial/state';
import { Attributes, Badge, Panel, RenderDate, Spacer, Text, theme } from '@metorial/ui';
import { ID, Table } from '@metorial/ui-product';
import { useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import styled from 'styled-components';
import { RouterPanel } from '../../scenes/routerPanel';

type SkillSync = DashboardInstanceSkillsSyncsGetOutput;

let statusColor = (status: SkillSync['status']): 'blue' | 'gray' | 'red' | 'orange' =>
  status === 'completed'
    ? 'blue'
    : status === 'failed' || status === 'canceled'
      ? 'red'
      : status === 'pending' || status === 'processing'
        ? 'orange'
        : 'gray';

let SkillSyncStatusBadge = ({ status }: { status: SkillSync['status'] }) => (
  <Badge color={statusColor(status)}>{status}</Badge>
);

export let SkillSyncsTable = ({
  emptyMessage,
  query
}: {
  emptyMessage: string;
  query: DashboardInstanceSkillsSyncsListQuery | null;
}) => {
  let instance = useCurrentInstance();
  let syncs = useSkillSyncs(
    instance.data?.id,
    query
      ? {
          ...query,
          order: query.order ?? 'desc'
        }
      : null
  );
  let [_, setSearchParams] = useSearchParams();

  return (
    <>
      {renderWithPagination(syncs)(syncs => (
        <>
          <Table
            headers={['Status', 'Created', 'Duration']}
            data={syncs.data.items.map(sync => ({
              data: [
                <SkillSyncStatusBadge status={sync.status} />,
                <RenderDate date={sync.createdAt} />,
                <SyncDuration sync={sync} />
              ],
              onClick: () =>
                setSearchParams(params => {
                  params.set('sync_id', sync.id);
                  return params;
                })
            }))}
          />

          {syncs.data.items.length == 0 && (
            <Text size="2" color="gray600" align="center" style={{ marginTop: 10 }}>
              {emptyMessage}
            </Text>
          )}
        </>
      ))}

      <RouterPanel param="sync_id" width={1000}>
        {syncId => (
          <>
            <Panel.Header>
              <Panel.Title>Sync Details</Panel.Title>
            </Panel.Header>

            <Panel.Content>
              <SkillSyncDetails syncId={syncId} />
            </Panel.Content>
          </>
        )}
      </RouterPanel>
    </>
  );
};

let SyncDuration = ({ sync }: { sync: SkillSync }) => {
  if (!sync.startedAt) return <Text color="gray600">Not started</Text>;
  if (!sync.completedAt) return <Text color="gray600">In progress</Text>;

  let durationMs = new Date(sync.completedAt).getTime() - new Date(sync.startedAt).getTime();
  return <span>{Math.max(0, Math.round(durationMs / 1000))}s</span>;
};

let SkillSyncDetails = ({ syncId }: { syncId: string }) => {
  let instance = useCurrentInstance();
  let sync = useSkillSync(instance.data?.id, syncId);

  return renderWithLoader({ sync })(({ sync }) => {
    return (
      <>
        <Attributes
          itemWidth="320px"
          attributes={[
            { label: 'Sync ID', content: <ID id={sync.data.id} /> },
            { label: 'Status', content: <SkillSyncStatusBadge status={sync.data.status} /> },
            {
              label: 'Started',
              content: sync.data.startedAt ? <RenderDate date={sync.data.startedAt} /> : 'N/A'
            },
            {
              label: 'Completed',
              content: sync.data.completedAt ? (
                <RenderDate date={sync.data.completedAt} />
              ) : (
                'N/A'
              )
            }
          ]}
        />

        {sync.data.repositoryPropagations.length > 0 && (
          <>
            <Spacer height={20} />
            <Text size="3" weight="strong">
              Repositories
            </Text>
            <Spacer height={10} />
            <Table
              headers={['Status', 'Branch', 'PR', 'Completed']}
              data={sync.data.repositoryPropagations.map(propagation => ({
                data: [
                  <SkillSyncStatusBadge status={propagation.status} />,
                  propagation.branchName,
                  propagation.prName,
                  propagation.completedAt ? (
                    <RenderDate date={propagation.completedAt} />
                  ) : (
                    'N/A'
                  )
                ]
              }))}
            />
          </>
        )}

        <Spacer height={20} />
        <Text size="3" weight="strong">
          Logs
        </Text>
        <Spacer height={10} />
        <SkillSyncLogs logs={sync.data.logs} />
      </>
    );
  });
};

let SkillSyncLogs = ({ logs }: { logs: SkillSync['logs'] }) => {
  let wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let wrapper = wrapperRef.current;
    if (!wrapper) return;
    wrapper.scrollTop = wrapper.scrollHeight;
  }, [logs]);

  return (
    <LogsWrapper ref={wrapperRef}>
      {logs.map((log, i) => (
        <LogLine key={`${log.timestamp.toISOString()}-${i}`}>
          <LogTimestamp>
            <RenderDate date={log.timestamp} />
          </LogTimestamp>
          <LogMessage>{log.message}</LogMessage>
        </LogLine>
      ))}
      {logs.length == 0 && (
        <div style={{ padding: 20 }}>
          <Text size="2" color="gray600">
            No logs for this sync.
          </Text>
        </div>
      )}
    </LogsWrapper>
  );
};

let LogsWrapper = styled.div`
  border: 1px solid ${theme.colors.gray300};
  border-radius: 8px;
  overflow: hidden;
  background: ${theme.colors.gray100};
  max-height: 400px;
  overflow-y: auto;
`;

let LogLine = styled.div`
  display: grid;
  grid-template-columns: 180px 1fr;
  gap: 12px;
  padding: 10px 12px;
  border-top: 1px solid ${theme.colors.gray300};

  &:first-child {
    border-top: 0;
  }
`;

let LogTimestamp = styled.div`
  color: ${theme.colors.gray600};
  font-size: 13px;
`;

let LogMessage = styled.div`
  font-size: 13px;
  white-space: pre-wrap;
`;
