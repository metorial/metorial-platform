import type {
  DashboardInstanceSkillsSyncsGetOutput,
  DashboardInstanceSkillsSyncsListQuery
} from '@metorial/dashboard-sdk';
import { renderWithLoader, renderWithPagination } from '@metorial/data-hooks';
import type { SkillMarketplaceRepository, SkillPluginRepository } from '@metorial/state';
import {
  useCurrentInstance,
  useSkillMarketplaceRepositories,
  useSkillPluginRepositories,
  useSkillSync,
  useSkillSyncs
} from '@metorial/state';
import {
  Attributes,
  Badge,
  Callout,
  Panel,
  RenderDate,
  Spacer,
  Text,
  theme
} from '@metorial/ui';
import { ID, Table } from '@metorial/ui-product';
import { useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import styled from 'styled-components';
import { RouterPanel } from '../../scenes/routerPanel';

type SkillSync = DashboardInstanceSkillsSyncsGetOutput;
type SkillRepository = SkillMarketplaceRepository | SkillPluginRepository;
type RepositoryPropagation = SkillSync['repositoryPropagations'][number];

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

let getRepositoryId = (repository: SkillRepository) => repository.repoId;
let getPropagationRepositoryId = (propagation: RepositoryPropagation) => propagation.repoId;

let getRepositoryLabel = (repository: SkillRepository) => {
  let r = repository as any;
  let name = r.repository?.name ?? repository.repoId;
  let owner =
    r.repository?.owner ??
    r.repository?.organization ??
    r.repository?.org ??
    r.repository?.url?.match(/[:/]([^/:]+)\/[^/]+?$/)?.[1];

  return owner ? `${owner}/${name}` : name;
};

let getErrorMessage = (value: unknown) => {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && 'message' in value) {
    let message = (value as { message?: unknown }).message;
    return typeof message === 'string' ? message : null;
  }
  return null;
};

let getRepositoryError = (
  repository?: SkillRepository,
  propagation?: RepositoryPropagation
) => {
  let r = repository as any;
  let p = propagation as any;
  return (
    getErrorMessage(p?.error) ??
    getErrorMessage(p?.lastError) ??
    getErrorMessage(p?.syncError) ??
    getErrorMessage(p?.errorMessage) ??
    getErrorMessage(r?.error) ??
    getErrorMessage(r?.lastError) ??
    getErrorMessage(r?.syncError) ??
    null
  );
};

let RepositorySyncStatus = ({ propagation }: { propagation?: RepositoryPropagation }) =>
  propagation ? (
    <SkillSyncStatusBadge status={propagation.status} />
  ) : (
    <Badge color="gray">Not queued</Badge>
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
  let repos1 = useSkillMarketplaceRepositories(
    instance.data?.id,
    sync.data?.skillMarketplaceId
  );
  let repos2 = useSkillPluginRepositories(instance.data?.id, sync.data?.skillPluginId);
  let reposLoader = sync.data?.skillMarketplaceId ? repos1 : repos2;

  return renderWithLoader({ sync })(({ sync }) => {
    let repositories = reposLoader.data?.items ?? [];
    let propagationByRepositoryId = new Map(
      sync.data.repositoryPropagations.map(
        propagation => [getPropagationRepositoryId(propagation), propagation] as const
      )
    );
    let repositoryRows = repositories.map(repository => ({
      repository,
      propagation: propagationByRepositoryId.get(getRepositoryId(repository))
    }));
    let repositoryIds = new Set(repositories.map(getRepositoryId));
    let unmatchedPropagations = sync.data.repositoryPropagations.filter(propagation => {
      let repositoryId = getPropagationRepositoryId(propagation);
      return !repositoryIds.has(repositoryId);
    });
    let shouldShowRepositories =
      repositories.length > 0 ||
      unmatchedPropagations.length > 0 ||
      reposLoader.isLoading ||
      reposLoader.error;
    let repositoryErrors = [
      ...repositoryRows.flatMap(({ repository, propagation }) => {
        let error = getRepositoryError(repository, propagation);
        return error ? [{ repository: getRepositoryLabel(repository), error }] : [];
      }),
      ...unmatchedPropagations.flatMap(propagation => {
        let error = getRepositoryError(undefined, propagation);
        return error ? [{ repository: getPropagationRepositoryId(propagation), error }] : [];
      })
    ];

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

        {shouldShowRepositories && (
          <>
            <Spacer height={20} />
            <Text size="3" weight="strong">
              Repositories
            </Text>
            <Spacer height={10} />

            {reposLoader.error && (
              <>
                <Text size="2" color="red500">
                  {reposLoader.error.message ?? 'Failed to load repositories.'}
                </Text>
                <Spacer height={10} />
              </>
            )}

            {reposLoader.isLoading && repositories.length == 0 && (
              <>
                <Text size="2" color="gray600">
                  Loading repositories...
                </Text>
                <Spacer height={10} />
              </>
            )}

            <Table
              headers={['Repository', 'Status', 'Branch', 'PR', 'Completed']}
              data={[
                ...repositoryRows.map(({ repository, propagation }) => ({
                  data: [
                    getRepositoryLabel(repository),
                    <RepositorySyncStatus propagation={propagation} />,
                    propagation?.branchName ?? 'N/A',
                    propagation?.prName ?? 'N/A',
                    propagation?.completedAt ? (
                      <RenderDate date={propagation.completedAt} />
                    ) : (
                      'N/A'
                    )
                  ]
                })),
                ...unmatchedPropagations.map(propagation => ({
                  data: [
                    getPropagationRepositoryId(propagation) ?? 'Unknown repository',
                    <SkillSyncStatusBadge status={propagation.status} />,
                    propagation.branchName,
                    propagation.prName,
                    propagation.completedAt ? (
                      <RenderDate date={propagation.completedAt} />
                    ) : (
                      'N/A'
                    )
                  ]
                }))
              ]}
            />

            {repositoryErrors.length > 0 && (
              <>
                <Spacer height={10} />
                {repositoryErrors.map(({ repository, error }) => (
                  <Callout color="red" key={`${repository}:${error}`}>
                    <div>
                      <Text size="2" weight="strong">
                        {repository}
                      </Text>
                      <Text size="2">{error}</Text>
                    </div>
                  </Callout>
                ))}
              </>
            )}
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
