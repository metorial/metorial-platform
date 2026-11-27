import type {
  DashboardInstanceSkillsSyncsGetOutput,
  DashboardInstanceSkillsSyncsListQuery
} from '@metorial/dashboard-sdk';
import { renderWithLoader } from '@metorial/data-hooks';
import { StatusBadge, col, createDataList, defineStatus } from '@metorial/data-list';
import { Paths } from '@metorial/frontend-config';
import type { SkillMarketplaceRepository, SkillPluginRepository } from '@metorial/state';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useSkillMarketplaceRepositories,
  useSkillPluginRepositories,
  useSkillSync,
  useForceSkillSync,
  useSkillSyncRepositoryChecks,
  useSkillSyncs
} from '@metorial/state';
import {
  AnimateHeight,
  Attributes,
  Badge,
  Button,
  Callout,
  confirm,
  Panel,
  RenderDate,
  Spacer,
  Text,
  theme
} from '@metorial/ui';
import { ID } from '@metorial/ui-product';
import React, { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import styled from 'styled-components';
import { useInstanceContext } from '../../lib/dataList';
import { RouterPanel } from '../../scenes/routerPanel';
import {
  getForceSyncDeleteCount,
  getForceSyncLabel,
  getPropagationDismissalMessage,
  getPropagationErrorMessage,
  getPropagationWaitingMessage,
  getRepositoryActionMessage
} from './skillSyncMessages';

type SkillSync = DashboardInstanceSkillsSyncsGetOutput;
type SkillRepository = SkillMarketplaceRepository | SkillPluginRepository;
type RepositoryPropagation = SkillSync['repositoryPropagations'][number];
type RepositoryCheck = NonNullable<
  ReturnType<typeof useSkillSyncRepositoryChecks>['data']
>['items'][number];

let skillSyncStatus = defineStatus({
  pending: { label: 'Pending', color: 'orange' },
  processing: { label: 'Syncing', color: 'orange' },
  waiting_for_review: { label: 'Action required', color: 'orange' },
  completed: { label: 'Completed', color: 'blue' },
  failed: { label: 'Failed', color: 'red' },
  canceled: { label: 'Canceled', color: 'red' }
});

export let SkillSyncStatusBadge = ({ status }: { status: SkillSync['status'] }) => (
  <StatusBadge status={status} descriptor={skillSyncStatus} />
);

let isContinuedSync = (sync: SkillSync) =>
  sync.status === 'canceled' &&
  sync.repositoryPropagations.length > 0 &&
  sync.repositoryPropagations.every(propagation => propagation.endReason === 'superseded');

let SyncStatusBadge = ({ sync }: { sync: SkillSync }) =>
  isContinuedSync(sync) ? (
    <Badge color="gray">Continued</Badge>
  ) : (
    <SkillSyncStatusBadge status={sync.status} />
  );

let PropagationStatusBadge = ({ propagation }: { propagation: RepositoryPropagation }) => {
  if (propagation.endReason === 'superseded') return <Badge color="gray">Continued</Badge>;
  if (propagation.endReason) return <Badge color="gray">Closed</Badge>;
  if (propagation.waitingUntil) return <Badge color="orange">Waiting</Badge>;
  return <SkillSyncStatusBadge status={propagation.status} />;
};

let getRepositoryId = (repository: SkillRepository) => repository.repoId;
let getPropagationRepositoryId = (propagation: RepositoryPropagation) => propagation.repoId;

export let getRepositoryLabel = (repository: SkillRepository) => {
  let r = repository as any;
  let name = r.repository?.name ?? repository.repoId;
  let owner =
    r.repository?.owner ??
    r.repository?.organization ??
    r.repository?.org ??
    r.repository?.url?.match(/[:/]([^/:]+)\/[^/]+?$/)?.[1];

  return owner ? `${owner}/${name}` : name;
};

export let getRepositoryUrl = (repository: SkillRepository) => {
  let r = repository as any;
  let url = r.repository?.url ?? r.url;
  return typeof url === 'string' ? url : null;
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
  repository: SkillRepository | undefined,
  propagation: RepositoryPropagation | undefined,
  provider: 'github' | 'gitlab' | 'bitbucket' | null,
  destination: 'marketplace' | 'plugin'
) => {
  let r = repository as any;
  let p = propagation as any;
  let propagationError =
    propagation &&
    !propagation.endReason &&
    ['failed', 'canceled'].includes(propagation.status);
  return (
    (propagationError
      ? (getErrorMessage(p?.error) ??
        getErrorMessage(p?.lastError) ??
        getErrorMessage(p?.syncError) ??
        getPropagationErrorMessage({
          provider,
          destination,
          errorCode: propagation?.errorCode,
          errorMessage: propagation?.errorMessage,
          unexpectedDeleteCount: propagation?.unexpectedDeleteCount
        }))
      : null) ??
    getErrorMessage(r?.error) ??
    getErrorMessage(r?.lastError) ??
    getErrorMessage(r?.syncError) ??
    null
  );
};

let getPullRequestsUrl = (repositoryCheck: RepositoryCheck) => {
  if (repositoryCheck.pullRequestUrl) return repositoryCheck.pullRequestUrl;
  if (!repositoryCheck.repositoryUrl) return null;
  let repositoryUrl = repositoryCheck.repositoryUrl
    .replace(/\.git\/?$/, '')
    .replace(/\/+$/, '');
  if (repositoryCheck.provider === 'github') return `${repositoryUrl}/pulls`;
  if (repositoryCheck.provider === 'gitlab') return `${repositoryUrl}/-/merge_requests`;
  if (repositoryCheck.provider === 'bitbucket') return `${repositoryUrl}/pull-requests`;
  return null;
};

let RepositoryAction = ({
  repositoryCheck,
  stacked = false
}: {
  repositoryCheck: RepositoryCheck;
  stacked?: boolean;
}) => {
  let isDirectPush = repositoryCheck.repositoryAccessMode === 'default_branch';
  let actionableBlockers = [
    'checks_failed',
    'reviews_required',
    'merge_conflict',
    'merge_permission_required',
    'merge_blocked',
    'provider_unavailable'
  ];
  if (
    !(
      isDirectPush &&
      (repositoryCheck.errorMessage ||
        repositoryCheck.blockers.includes('provider_unavailable'))
    ) &&
    repositoryCheck.status !== 'waiting_for_review' &&
    repositoryCheck.overrideAttemptStatus !== 'attempting' &&
    repositoryCheck.overrideAttemptStatus !== 'refused' &&
    !repositoryCheck.blockers.some(blocker => actionableBlockers.includes(blocker))
  ) {
    return null;
  }
  let pullRequestsUrl = getPullRequestsUrl(repositoryCheck);
  let relevantChecks = repositoryCheck.checks.filter(check =>
    ['failed', 'failure', 'pending', 'running', 'in_progress'].includes(check.status)
  );
  let visibleChecks = relevantChecks.slice(0, 5);

  return (
    <Callout color={isDirectPush && repositoryCheck.status === 'failed' ? 'red' : 'orange'}>
      <RepositoryActionContent $stacked={stacked}>
        <div>
          <Text size="2" weight="strong">
            {repositoryCheck.repositoryName}
          </Text>
          <Text size="2">{getRepositoryActionMessage(repositoryCheck)}</Text>
          {visibleChecks.length > 0 && (
            <CheckList>
              {visibleChecks.map(check => (
                <li key={`${check.name}:${check.status}`}>
                  {check.url ? (
                    <ExternalLink href={check.url} target="_blank" rel="noopener noreferrer">
                      {check.name}
                    </ExternalLink>
                  ) : (
                    check.name
                  )}{' '}
                  — {check.status}
                </li>
              ))}
              {relevantChecks.length > visibleChecks.length && (
                <li>{relevantChecks.length - visibleChecks.length} more checks</li>
              )}
            </CheckList>
          )}
        </div>
        <RepositoryLinks $stacked={stacked}>
          {!isDirectPush && pullRequestsUrl && (
            <a href={pullRequestsUrl} target="_blank" rel="noopener noreferrer">
              <Button as="span" size={stacked ? '1' : '2'}>
                Open {repositoryCheck.provider === 'gitlab' ? 'merge request' : 'pull request'}
              </Button>
            </a>
          )}
          {repositoryCheck.repositoryUrl && (
            <a href={repositoryCheck.repositoryUrl} target="_blank" rel="noopener noreferrer">
              <Button
                as="span"
                size={stacked ? '1' : '2'}
                variant={stacked ? 'outline' : undefined}
              >
                Open repository
              </Button>
            </a>
          )}
        </RepositoryLinks>
      </RepositoryActionContent>
    </Callout>
  );
};

let RepositorySyncStatus = ({
  propagation,
  syncStatus
}: {
  propagation?: RepositoryPropagation;
  syncStatus: SkillSync['status'];
}) =>
  propagation ? (
    <PropagationStatusBadge propagation={propagation} />
  ) : ['pending', 'processing', 'waiting_for_review'].includes(syncStatus) ? (
    <SkillSyncStatusBadge status="pending" />
  ) : (
    <Badge color="gray">Skipped</Badge>
  );

type SyncTiming = Pick<SkillSync, 'startedAt' | 'completedAt'>;

let SyncDuration = ({ sync }: { sync: SyncTiming }) => {
  if (!sync.startedAt) return <Text color="gray600">Not started</Text>;
  if (!sync.completedAt) return <Text color="gray600">In progress</Text>;

  let durationMs = new Date(sync.completedAt).getTime() - new Date(sync.startedAt).getTime();
  return <span>{Math.max(0, Math.round(durationMs / 1000))}s</span>;
};

let SkillSyncsList = createDataList<{ query: DashboardInstanceSkillsSyncsListQuery | null }>(
  'skill-syncs',
  { customizable: false }
)
  .context(useInstanceContext)
  .paginated(({ props, ctx }) =>
    useSkillSyncs(
      ctx.instanceId,
      props.query ? { ...props.query, order: props.query.order ?? 'desc' } : null
    )
  )
  .columns([
    col.custom<SkillSync>({
      id: 'status',
      header: 'Status',
      render: sync => <SyncStatusBadge sync={sync} />
    }),
    col.createdAt(),
    col.custom<any>({
      id: 'duration',
      header: 'Duration',
      render: sync => <SyncDuration sync={sync} />
    })
  ])
  .build();

export let SkillSyncsTable = ({
  emptyMessage,
  query
}: {
  emptyMessage: string;
  query: DashboardInstanceSkillsSyncsListQuery | null;
}) => {
  let [_, setSearchParams] = useSearchParams();

  return (
    <>
      <SkillSyncsList
        query={query}
        emptyState={emptyMessage}
        onItemClick={sync =>
          setSearchParams(params => {
            params.set('sync_id', sync.id);
            return params;
          })
        }
      />

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

type RepositoryRow = {
  id: string;
  repository: React.ReactNode;
  status: React.ReactNode;
  provider?: 'github' | 'gitlab' | 'bitbucket' | null;
  branch?: string | null;
  completedAt?: Date | string | null;
};

let createRepositoriesList = (name: string, withCompleted: boolean) =>
  createDataList(name, { customizable: false })
    .items(({ props }: { props: { rows: RepositoryRow[] } }) => ({ items: props.rows }))
    .columns([
      col.custom<RepositoryRow>({
        id: 'repository',
        header: 'Repository',
        render: row => row.repository
      }),
      col.custom<RepositoryRow>({ id: 'status', header: 'Status', render: row => row.status }),
      col.text<RepositoryRow>({ id: 'branch', header: 'Branch', get: row => row.branch }),
      ...(withCompleted
        ? [
            col.date<RepositoryRow>('completedAt', {
              header: 'Completed',
              isDefault: true
            })
          ]
        : [])
    ])
    .build();

let RepositoriesList = createRepositoriesList('skill-sync-repositories', true);
let CompactRepositoriesList = createRepositoriesList('skill-sync-repositories-compact', false);

let providerLabels = { github: 'GitHub', gitlab: 'GitLab', bitbucket: 'Bitbucket' } as const;

export let getRepositoryProviderLabel = (provider: RepositoryRow['provider']) =>
  provider ? providerLabels[provider] : null;

export let SyncRepositoryStack = ({ rows }: { rows: RepositoryRow[] }) => (
  <RepositoryStack>
    {rows.map(row => (
      <RepositoryStackItem key={row.id}>
        <RepositoryStackHead>
          <RepositoryStackName>{row.repository}</RepositoryStackName>
          {row.status}
        </RepositoryStackHead>
        <RepositoryStackMeta>
          {[getRepositoryProviderLabel(row.provider), row.branch]
            .filter(Boolean)
            .join(' · ') || 'Repository'}
        </RepositoryStackMeta>
      </RepositoryStackItem>
    ))}
  </RepositoryStack>
);

export let SkillSyncDetails = ({
  syncId,
  compact: compactProp = false,
  rail = false,
  logs = 'always',
  pollInterval
}: {
  syncId: string;
  compact?: boolean;
  rail?: boolean;
  logs?: 'always' | 'active-or-failed' | 'never';
  pollInterval?: number | null;
}) => {
  let compact = compactProp || rail;
  let instance = useCurrentInstance();
  let sync = useSkillSync(instance.data?.id, syncId, { pollInterval });
  let syncDataCacheRef = useRef<{ syncId: string; data: typeof sync.data }>({
    syncId,
    data: sync.data
  });
  if (syncDataCacheRef.current.syncId !== syncId) {
    syncDataCacheRef.current = { syncId, data: null };
  }
  if (sync.data) syncDataCacheRef.current.data = sync.data;
  let stableSyncData = sync.data ?? syncDataCacheRef.current.data;
  let stableSync = {
    ...sync,
    data: stableSyncData,
    isLoading: sync.isLoading && !stableSyncData,
    error: stableSyncData ? null : sync.error
  };
  let repositoryChecks = useSkillSyncRepositoryChecks(instance.data?.id, syncId);
  let repositoryChecksRefetchRef = useRef(repositoryChecks.refetch);
  repositoryChecksRefetchRef.current = repositoryChecks.refetch;
  let wasActiveRef = useRef(false);
  let repos1 = useSkillMarketplaceRepositories(
    instance.data?.id,
    stableSyncData?.skillMarketplaceId
  );
  let repos2 = useSkillPluginRepositories(instance.data?.id, stableSyncData?.skillPluginId);
  let reposLoader = stableSyncData?.skillMarketplaceId ? repos1 : repos2;

  useEffect(() => {
    let active = Boolean(
      stableSyncData?.status &&
      ['pending', 'processing', 'waiting_for_review'].includes(stableSyncData.status)
    );
    if (!active) {
      if (wasActiveRef.current) repositoryChecksRefetchRef.current();
      wasActiveRef.current = false;
      return;
    }
    wasActiveRef.current = true;
    let id = setInterval(() => repositoryChecksRefetchRef.current(), 5_000);
    return () => clearInterval(id);
  }, [stableSyncData?.status]);

  return renderWithLoader({ sync: stableSync })(({ sync }) => {
    let repositories = reposLoader.data?.items ?? [];
    let destination = sync.data.skillPluginId ? ('plugin' as const) : ('marketplace' as const);
    let propagationByRepositoryId = new Map(
      sync.data.repositoryPropagations.map(
        propagation => [getPropagationRepositoryId(propagation), propagation] as const
      )
    );
    let repositoryCheckByRepositoryId = new Map(
      (repositoryChecks.data?.items ?? []).map(check => [check.repoId, check] as const)
    );
    let directCheckRepositoryIds = new Set(
      (repositoryChecks.data?.items ?? [])
        .filter(
          check =>
            check.repositoryAccessMode === 'default_branch' &&
            (check.errorMessage || check.blockers.includes('provider_unavailable'))
        )
        .map(check => check.repoId)
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
        if (directCheckRepositoryIds.has(getRepositoryId(repository))) return [];
        let error = getRepositoryError(
          repository,
          propagation,
          repository.repository.provider,
          destination
        );
        return error ? [{ repository: getRepositoryLabel(repository), error }] : [];
      }),
      ...unmatchedPropagations.flatMap(propagation => {
        if (directCheckRepositoryIds.has(getPropagationRepositoryId(propagation))) return [];
        let error = getRepositoryError(
          undefined,
          propagation,
          repositoryCheckByRepositoryId.get(propagation.repoId)?.provider ?? null,
          destination
        );
        return error ? [{ repository: getPropagationRepositoryId(propagation), error }] : [];
      })
    ];
    let propagationNotices = [
      ...repositoryRows.flatMap(({ repository, propagation }) =>
        propagation
          ? [
              {
                repository: getRepositoryLabel(repository),
                provider: repository.repository.provider,
                propagation
              }
            ]
          : []
      ),
      ...unmatchedPropagations.map(propagation => ({
        repository: getPropagationRepositoryId(propagation),
        provider: repositoryCheckByRepositoryId.get(propagation.repoId)?.provider ?? null,
        propagation
      }))
    ].filter(
      ({ propagation }) =>
        propagation.endReason ||
        (propagation.waitingUntil &&
          ['pending', 'processing', 'waiting_for_review'].includes(propagation.status))
    );

    let repositoryTableRows: RepositoryRow[] = [
      ...repositoryRows.map(({ repository, propagation }) => {
        let repositoryCheck = repositoryCheckByRepositoryId.get(getRepositoryId(repository));
        let url = getRepositoryUrl(repository);

        return {
          id: getRepositoryId(repository),
          repository: url ? (
            <ExternalLink
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={event => event.stopPropagation()}
            >
              {getRepositoryLabel(repository)}
            </ExternalLink>
          ) : (
            getRepositoryLabel(repository)
          ),
          status: (
            <RepositorySyncStatus propagation={propagation} syncStatus={sync.data.status} />
          ),
          provider: repository.repository.provider,
          branch: repositoryCheck?.targetBranch ?? propagation?.branchName,
          completedAt: propagation?.completedAt
        };
      }),
      ...unmatchedPropagations.map(propagation => ({
        id: `unmatched:${getPropagationRepositoryId(propagation)}`,
        repository: getPropagationRepositoryId(propagation) ?? 'Unknown repository',
        status: <PropagationStatusBadge propagation={propagation} />,
        provider: repositoryCheckByRepositoryId.get(propagation.repoId)?.provider ?? null,
        branch:
          repositoryCheckByRepositoryId.get(propagation.repoId)?.targetBranch ??
          propagation.branchName,
        completedAt: propagation.completedAt
      }))
    ];

    return (
      <>
        {!compact && (
          <Attributes
            itemWidth="320px"
            attributes={[
              { label: 'Sync ID', content: <ID id={sync.data.id} /> },
              { label: 'Status', content: <SyncStatusBadge sync={sync.data} /> },
              {
                label: 'Started',
                content: sync.data.startedAt ? (
                  <RenderDate date={sync.data.startedAt} />
                ) : (
                  'N/A'
                )
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
        )}

        {shouldShowRepositories && (
          <>
            {!compact && <Spacer height={20} />}

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

            {rail ? (
              <SyncRepositoryStack rows={repositoryTableRows} />
            ) : (
              React.createElement(compact ? CompactRepositoriesList : RepositoriesList, {
                rows: repositoryTableRows,
                listVariant: 'embedded',
                emptyState: 'No repositories.'
              })
            )}

            {repositoryChecks.error && (
              <>
                <Spacer height={10} />
                <Text size="2" color="gray600">
                  We couldn't load repository checks. Syncing will continue in the background.
                </Text>
              </>
            )}

            {repositoryChecks.data?.items.length ? (
              <>
                <Spacer height={10} />
                <RepositoryActions>
                  {repositoryChecks.data.items.map(repositoryCheck => (
                    <RepositoryAction
                      key={repositoryCheck.propagationId}
                      repositoryCheck={repositoryCheck}
                      stacked={rail}
                    />
                  ))}
                </RepositoryActions>
              </>
            ) : null}

            {propagationNotices.length > 0 && (
              <>
                <Spacer height={10} />
                <RepositoryActions>
                  {propagationNotices.map(notice => (
                    <PropagationNotice
                      key={notice.propagation.id}
                      repository={notice.repository}
                      provider={notice.provider}
                      propagation={notice.propagation}
                      skillMarketplaceId={sync.data.skillMarketplaceId}
                      compact={compact}
                    />
                  ))}
                </RepositoryActions>
              </>
            )}

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

            <ForceDeletionSync sync={sync.data} compact={compact} />
          </>
        )}

        {logs === 'always' ||
        (logs === 'active-or-failed' &&
          ['processing', 'failed'].includes(sync.data.status)) ? (
          rail ? (
            <RailLogs logs={sync.data.logs} />
          ) : (
            <>
              <Spacer height={20} />
              <Text size="2" weight="strong">
                Logs
              </Text>
              <Spacer height={6} />
              <SkillSyncLogs logs={sync.data.logs} />
            </>
          )
        ) : null}
      </>
    );
  });
};

let ForceDeletionSync = ({ sync, compact }: { sync: SkillSync; compact: boolean }) => {
  let instance = useCurrentInstance();
  let forceSync = useForceSkillSync();
  let [_, setSearchParams] = useSearchParams();

  let tripped = sync.repositoryPropagations.filter(
    propagation =>
      propagation.errorCode === 'deletion_guard_tripped' &&
      propagation.status === 'failed' &&
      !propagation.endReason
  );
  if (!tripped.length || !instance.data) return null;

  let unexpectedDeleteCount = getForceSyncDeleteCount(
    tripped.map(propagation => propagation.unexpectedDeleteCount)
  );
  let label = getForceSyncLabel(unexpectedDeleteCount);
  let instanceId = instance.data.id;

  return (
    <>
      <Spacer height={10} />
      <ForceSyncActions>
        <Button
          size="2"
          color="red"
          loading={forceSync.isLoading}
          onClick={() =>
            confirm({
              title: `${label}?`,
              description: `Metorial will start a new sync and delete the files it didn't expect in ${
                tripped.length === 1 ? 'the repository' : `${tripped.length} repositories`
              }. Deleted files can only be restored from the repository's history.`,
              confirmText: label,
              onConfirm: async () => {
                let [forced] = await forceSync.mutate({
                  instanceId,
                  skillSyncId: sync.id,
                  allowMassDelete: true
                });
                if (!forced || compact) return;
                setSearchParams(params => {
                  params.set('sync_id', forced.id);
                  return params;
                });
              }
            })
          }
        >
          {label}
        </Button>
      </ForceSyncActions>
    </>
  );
};

let ContinuedInSyncLink = ({
  syncId,
  skillMarketplaceId,
  compact
}: {
  syncId: string;
  skillMarketplaceId: string | null;
  compact: boolean;
}) => {
  let instance = useCurrentInstance();
  let organization = useCurrentOrganization();
  let project = useCurrentProject();
  let [searchParams] = useSearchParams();

  if (compact && skillMarketplaceId) {
    let syncsPath = Paths.instance.skillMarketplace(
      organization.data,
      project.data,
      instance.data,
      skillMarketplaceId,
      'syncs'
    );

    return (
      <SyncLink to={`${syncsPath}?${new URLSearchParams({ sync_id: syncId })}`}>
        {syncId}
      </SyncLink>
    );
  }

  let nextSearchParams = new URLSearchParams(searchParams);
  nextSearchParams.set('sync_id', syncId);

  return <SyncLink to={{ search: nextSearchParams.toString() }}>{syncId}</SyncLink>;
};

let PropagationNotice = ({
  repository,
  provider,
  propagation,
  skillMarketplaceId,
  compact
}: {
  repository: string;
  provider: 'github' | 'gitlab' | 'bitbucket' | null;
  propagation: RepositoryPropagation;
  skillMarketplaceId: string | null;
  compact: boolean;
}) => {
  let input = { ...propagation, provider };
  let message =
    propagation.endReason === 'superseded' ? (
      <>
        Continued in sync{' '}
        {propagation.continuedInSyncId ? (
          <ContinuedInSyncLink
            syncId={propagation.continuedInSyncId}
            skillMarketplaceId={skillMarketplaceId}
            compact={compact}
          />
        ) : (
          'a newer sync'
        )}
        .
      </>
    ) : propagation.endReason ? (
      getPropagationDismissalMessage(input)
    ) : (
      getPropagationWaitingMessage(input)
    );

  if (!message) return null;

  return (
    <Callout color="gray">
      <div>
        <Text size="2" weight="strong">
          {repository}
        </Text>
        <Text size="2">{message}</Text>
      </div>
    </Callout>
  );
};

let RailLogs = ({ logs }: { logs: SkillSync['logs'] }) => {
  let [open, setOpen] = useState(true);

  return (
    <>
      <Spacer height={14} />
      <RailLogsHeader>
        <Text size="2" weight="strong">
          Logs
        </Text>
        <Button size="1" variant="ghost" onClick={() => setOpen(current => !current)}>
          {open ? 'Hide' : 'Show'}
        </Button>
      </RailLogsHeader>
      <AnimateHeight>
        {open && (
          <>
            <Spacer height={6} />
            <SkillSyncLogs logs={logs} stacked />
          </>
        )}
      </AnimateHeight>
    </>
  );
};

let SkillSyncLogs = ({
  logs,
  stacked = false
}: {
  logs: SkillSync['logs'];
  stacked?: boolean;
}) => {
  let wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let wrapper = wrapperRef.current;
    if (!wrapper) return;
    wrapper.scrollTop = wrapper.scrollHeight;
  }, [logs]);

  return (
    <LogsWrapper ref={wrapperRef} $stacked={stacked}>
      {logs.map((log, i) => (
        <LogLine key={`${log.timestamp.toISOString()}-${i}`} $stacked={stacked}>
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

let LogsWrapper = styled.div<{ $stacked?: boolean }>`
  border: 1px solid ${theme.colors.gray300};
  border-radius: 8px;
  overflow: hidden;
  background: ${theme.colors.gray100};
  max-height: ${({ $stacked }) => ($stacked ? 240 : 400)}px;
  overflow-y: auto;
`;

let LogLine = styled.div<{ $stacked?: boolean }>`
  display: grid;
  grid-template-columns: ${({ $stacked }) => ($stacked ? '1fr' : '180px 1fr')};
  gap: ${({ $stacked }) => ($stacked ? 2 : 12)}px;
  padding: ${({ $stacked }) => ($stacked ? '8px 10px' : '10px 12px')};
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

let RepositoryActions = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

let RepositoryActionContent = styled.div<{ $stacked?: boolean }>`
  display: flex;
  flex-direction: ${({ $stacked }) => ($stacked ? 'column' : 'row')};
  justify-content: space-between;
  gap: ${({ $stacked }) => ($stacked ? 10 : 16)}px;
  width: 100%;
  min-width: 0;
`;

let ForceSyncActions = styled.div`
  display: flex;
  justify-content: flex-end;
`;

let RepositoryLinks = styled.div<{ $stacked?: boolean }>`
  display: flex;
  flex-shrink: 0;
  flex-wrap: ${({ $stacked }) => ($stacked ? 'wrap' : 'nowrap')};
  align-items: flex-start;
  gap: ${({ $stacked }) => ($stacked ? 6 : 10)}px;
`;

let RailLogsHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

let RepositoryStack = styled.div`
  display: flex;
  flex-direction: column;
  border: 1px solid ${theme.colors.gray300};
  border-radius: 8px;
  overflow: hidden;
`;

let RepositoryStackItem = styled.div`
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 3px;

  & + & {
    border-top: 1px solid ${theme.colors.gray300};
  }
`;

let RepositoryStackHead = styled.div`
  min-height: 22px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
`;

let RepositoryStackName = styled.div`
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
  font-weight: 500;
`;

let RepositoryStackMeta = styled.div`
  font-size: 12px;
  color: ${theme.colors.gray600};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

let ExternalLink = styled.a`
  color: ${theme.colors.primary};
  font-size: 13px;
  font-weight: 500;
  text-decoration: none;
`;

let SyncLink = styled(Link)`
  color: ${theme.colors.primary};
  font-weight: 500;
  text-decoration: none;
`;

let CheckList = styled.ul`
  margin: 6px 0 0;
  padding-left: 18px;
  color: ${theme.colors.gray700};
  font-size: 13px;
`;
