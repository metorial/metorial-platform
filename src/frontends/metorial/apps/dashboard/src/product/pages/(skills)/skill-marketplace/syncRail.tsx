import { Paths } from '@metorial/frontend-config';
import {
  SkillMarketplaceRepositoriesSettingsContentScene,
  SkillMarketplaceRepositoryAccessSettings,
  useSkillMarketplaceRepositoriesManager
} from '@metorial/scene-skills';
import {
  type SkillMarketplaceRepository,
  type SkillSync,
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useSkillMarketplace,
  useSkillSyncs
} from '@metorial/state';
import {
  AnimateHeight,
  Badge,
  Button,
  Dialog,
  Menu,
  Skeleton,
  Spinner,
  Text,
  showModal,
  theme
} from '@metorial/ui';
import {
  RiAddLine,
  RiCheckboxCircleFill,
  RiCloseCircleFill,
  RiErrorWarningFill,
  RiGitRepositoryLine,
  RiHistoryLine,
  RiMore2Line,
  RiTimeLine
} from '@remixicon/react';
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useInterval } from 'react-use';
import styled, { css } from 'styled-components';
import {
  SkillSyncDetails,
  SyncRepositoryStack,
  getRepositoryLabel,
  getRepositoryUrl
} from '../skillSyncs';
import { getSyncStatusMessage } from './repositorySyncMessage';
import { shouldShowRepositorySyncLogs } from './repositorySyncVisibility';

let activePollMs = 3_000;
let idlePollMs = 15_000;
let burstPollWindowMs = 60_000;

let activeSyncStatuses: SkillSync['status'][] = [
  'pending',
  'processing',
  'waiting_for_review'
];

type RailState = 'syncing' | 'pending' | 'attention' | 'failed' | 'synced' | 'idle';

let railStates: Record<
  RailState,
  { label: string; tone: 'blue' | 'orange' | 'red' | 'green' | 'gray' }
> = {
  syncing: { label: 'Syncing', tone: 'blue' },
  pending: { label: 'Changes waiting to sync', tone: 'orange' },
  attention: { label: 'Action required', tone: 'orange' },
  failed: { label: 'Sync failed', tone: 'red' },
  synced: { label: 'Up to date', tone: 'green' },
  idle: { label: 'Not synced yet', tone: 'gray' }
};

let toneColors = {
  blue: { foreground: theme.colors.blue900, background: theme.colors.blue300 },
  orange: { foreground: theme.colors.orange900, background: theme.colors.orange200 },
  red: { foreground: theme.colors.red900, background: theme.colors.red200 },
  green: { foreground: theme.colors.green900, background: theme.colors.green200 },
  gray: { foreground: theme.colors.gray700, background: theme.colors.gray250 }
};

let Card = styled.section`
  border: 1px solid ${theme.colors.gray400};
  border-radius: 10px;
  background: ${theme.colors.background};
  box-shadow: ${theme.shadows.small};
  overflow: hidden;
`;

let CardHeader = styled.div`
  padding: 14px 12px 14px 14px;
  display: flex;
  align-items: center;
  gap: 10px;
`;

let StatusIconSlot = styled.span<{ $tone: keyof typeof toneColors }>`
  position: relative;
  width: 34px;
  height: 34px;
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
  color: ${({ $tone }) => toneColors[$tone].foreground};
  background: ${({ $tone }) => toneColors[$tone].background};
  transition:
    background 200ms ease,
    color 200ms ease;

  svg {
    width: 18px;
    height: 18px;
  }
`;

let StatusIconInner = styled(motion.span)`
  position: absolute;
  inset: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
`;

let HeaderText = styled.div`
  min-width: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 1px;

  p {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
`;

let StateLabel = styled.span<{ $tone: keyof typeof toneColors }>`
  font-size: 12px;
  font-weight: 500;
  color: ${({ $tone }) => ($tone === 'gray' ? theme.colors.gray600 : toneColors[$tone].foreground)};
  transition: color 200ms ease;
`;

let Section = styled.div`
  padding: 0 14px 14px;
`;

let Footer = styled.div`
  padding: 12px 14px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  border-top: 1px solid ${theme.colors.gray300};
  background: ${theme.colors.gray100};
`;

let PendingCallout = styled.div`
  margin-bottom: 12px;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  border-radius: 8px;
  background: ${theme.colors.orange200};
`;

let EmptyBody = styled.div`
  padding: 4px 14px 16px;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 12px;
`;

let skeletonLine = css`
  display: block;
  height: 12px;
`;

let SkeletonLine = styled.span<{ $width: string }>`
  ${skeletonLine}
  width: ${({ $width }) => $width};
`;

let showRepositoryAccessSettings = (
  p: { instanceId: string | null | undefined; skillMarketplaceId: string | null | undefined },
  onSave: () => void | Promise<void>
) =>
  showModal(({ close, dialogProps }) => (
    <Dialog.Wrapper {...dialogProps} width={520}>
      <Dialog.Title>Repository Sync Settings</Dialog.Title>
      <Dialog.Description>
        Choose how marketplace changes are written to linked repositories.
      </Dialog.Description>
      <SkillMarketplaceRepositoryAccessSettings
        {...p}
        boxed={false}
        onSaveSuccess={async () => {
          await onSave();
          close();
        }}
      />
    </Dialog.Wrapper>
  ));

let showManageRepositories = (
  p: { instanceId: string | null | undefined; skillMarketplaceId: string | null | undefined },
  onChange: () => void | Promise<void>
) =>
  showModal(({ dialogProps }) => (
    <Dialog.Wrapper {...dialogProps} width={900}>
      <Dialog.Title>Manage Repositories</Dialog.Title>
      <Dialog.Description>
        Review and unlink repositories connected to this marketplace.
      </Dialog.Description>
      <SkillMarketplaceRepositoriesSettingsContentScene
        {...p}
        showLinkAction
        onChange={onChange}
      />
    </Dialog.Wrapper>
  ));

let getRailState = (
  sync: SkillSync | undefined,
  marketplaceSyncStatus: string | undefined
): RailState => {
  if (sync?.status === 'processing' || marketplaceSyncStatus === 'processing')
    return 'syncing';
  if (sync?.status === 'waiting_for_review') return 'attention';
  if (marketplaceSyncStatus === 'pending') return 'pending';
  if (sync?.status === 'failed') return 'failed';
  if (sync?.status === 'completed') return 'synced';
  return 'idle';
};

let StatusIcon = ({ state }: { state: RailState }) => (
  <StatusIconSlot $tone={railStates[state].tone} aria-hidden>
    <AnimatePresence initial={false}>
      <StatusIconInner
        key={state}
        initial={{ opacity: 0, scale: 0.6 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.6 }}
        transition={{ duration: 0.18 }}
      >
        {state === 'syncing' && <Spinner size={16} />}
        {state === 'pending' && <RiTimeLine />}
        {state === 'attention' && <RiErrorWarningFill />}
        {state === 'failed' && <RiCloseCircleFill />}
        {state === 'synced' && <RiCheckboxCircleFill />}
        {state === 'idle' && <RiGitRepositoryLine />}
      </StatusIconInner>
    </AnimatePresence>
  </StatusIconSlot>
);

let getRepositoryRows = (repositories: SkillMarketplaceRepository[]) =>
  repositories.map(repository => {
    let url = getRepositoryUrl(repository);
    let label = getRepositoryLabel(repository);

    return {
      id: repository.repoId,
      repository: url ? (
        <a href={url} target="_blank" rel="noopener noreferrer">
          {label}
        </a>
      ) : (
        label
      ),
      status: <Badge color="gray">Not synced</Badge>,
      provider: repository.repository.provider,
      branch: null
    };
  });

let RailSkeleton = () => (
  <Card aria-busy="true">
    <CardHeader>
      <Skeleton active borderRadius={10}>
        <span style={{ display: 'block', width: 34, height: 34 }} />
      </Skeleton>
      <HeaderText>
        <Skeleton active>
          <SkeletonLine $width="120px" />
        </Skeleton>
      </HeaderText>
    </CardHeader>
    <Section>
      <Skeleton active>
        <SkeletonLine $width="220px" />
      </Skeleton>
    </Section>
  </Card>
);

export let SkillMarketplaceSyncRail = (p: {
  skillMarketplaceId: string | null | undefined;
  changeSignal?: number;
}) => {
  let instance = useCurrentInstance();
  let organization = useCurrentOrganization();
  let project = useCurrentProject();
  let navigate = useNavigate();
  let marketplace = useSkillMarketplace(instance.data?.id, p.skillMarketplaceId);
  let syncMarketplace = marketplace.syncMutator();
  let syncs = useSkillSyncs(
    instance.data?.id,
    p.skillMarketplaceId
      ? {
          skillMarketplaceId: p.skillMarketplaceId,
          status: ['completed', 'processing', 'waiting_for_review', 'failed'],
          order: 'desc',
          limit: 1
        }
      : null,
    { pollInterval: null }
  );
  let syncCacheRef = useRef<{ key: string | null | undefined; sync: SkillSync | undefined }>({
    key: p.skillMarketplaceId,
    sync: undefined
  });
  if (syncCacheRef.current.key !== p.skillMarketplaceId) {
    syncCacheRef.current = { key: p.skillMarketplaceId, sync: undefined };
  }
  if (syncs.data) syncCacheRef.current.sync = syncs.data.items[0];
  let latestSync = syncs.data ? syncs.data.items[0] : syncCacheRef.current.sync;
  let syncsLoaded = Boolean(syncs.data) || Boolean(syncCacheRef.current.sync) || !!syncs.error;

  let burstUntilRef = useRef(0);
  let refresh = () => Promise.all([syncs.refetch(), marketplace.refetch()]).then(() => {});
  let repositoryManager = useSkillMarketplaceRepositoriesManager({
    instanceId: instance.data?.id,
    skillMarketplaceId: p.skillMarketplaceId,
    onChange: refresh
  });
  let repositories = repositoryManager.repositories.data?.items ?? [];
  let settingsProps = {
    instanceId: instance.data?.id,
    skillMarketplaceId: p.skillMarketplaceId
  };

  let marketplaceSyncStatus = marketplace.data?.syncStatus;
  let syncActive = Boolean(latestSync && activeSyncStatuses.includes(latestSync.status));
  let state = getRailState(latestSync, marketplaceSyncStatus);
  let wantsFastPoll =
    syncActive ||
    (marketplaceSyncStatus !== undefined && marketplaceSyncStatus !== 'synced') ||
    Date.now() < burstUntilRef.current;

  let isFirstSignalRef = useRef(true);
  useEffect(() => {
    if (isFirstSignalRef.current) {
      isFirstSignalRef.current = false;
      return;
    }

    burstUntilRef.current = Date.now() + burstPollWindowMs;
    void refresh();
  }, [p.changeSignal]);

  useInterval(
    () => {
      if (document.visibilityState === 'hidden') return;
      void refresh();
    },
    repositories.length ? (wantsFastPoll ? activePollMs : idlePollMs) : null
  );

  let syncNow = async () => {
    let [synced] = await syncMarketplace.mutate({});
    if (!synced) return;

    burstUntilRef.current = Date.now() + burstPollWindowMs;
    await refresh();
  };

  let openSyncHistory = () => {
    if (!p.skillMarketplaceId) return;

    navigate(
      Paths.instance.skillMarketplace(
        organization.data,
        project.data,
        instance.data,
        p.skillMarketplaceId,
        'syncs'
      )
    );
  };

  if (!repositoryManager.repositories.data && !repositoryManager.repositories.error) {
    return <RailSkeleton />;
  }

  if (!repositories.length) {
    return (
      <Card>
        <CardHeader>
          <StatusIcon state="idle" />
          <HeaderText>
            <Text size="2" weight="strong">
              Repository Sync
            </Text>
            <StateLabel $tone="gray">No repository linked</StateLabel>
          </HeaderText>
        </CardHeader>

        <EmptyBody>
          <Text size="2" color="gray650">
            Link a GitHub, GitLab or Bitbucket repository to publish this marketplace there and
            keep it in sync automatically.
          </Text>
          <Button size="2" iconLeft={<RiAddLine />} onClick={repositoryManager.openPicker}>
            Link Repository
          </Button>
        </EmptyBody>
      </Card>
    );
  }

  let sentence = !latestSync
    ? 'No sync has run for the linked repositories yet.'
    : state === 'syncing' && latestSync.status !== 'processing'
      ? 'Writing your latest changes to the linked repositories...'
      : getSyncStatusMessage(latestSync, repositories);

  return (
    <Card>
      <CardHeader>
        <StatusIcon state={state} />

        <HeaderText>
          <Text size="2" weight="strong">
            Repository Sync
          </Text>
          <StateLabel $tone={railStates[state].tone}>{railStates[state].label}</StateLabel>
        </HeaderText>

        <Menu
          items={[
            { id: 'link', label: 'Link Repository', onClick: repositoryManager.openPicker },
            {
              id: 'manage',
              label: 'Manage Repositories',
              onClick: () => showManageRepositories(settingsProps, refresh)
            },
            {
              id: 'access',
              label: 'Repository Sync Settings',
              onClick: () => showRepositoryAccessSettings(settingsProps, refresh)
            }
          ]}
        >
          <Button
            size="1"
            variant="ghost"
            aria-label="Repository sync options"
            title="Repository sync options"
            iconLeft={<RiMore2Line />}
          />
        </Menu>
      </CardHeader>

      <Section>
        <AnimateHeight>
          {state === 'pending' && (
            <PendingCallout>
              <Text size="2" weight="strong">
                You have unsynced changes
              </Text>
              <Text size="2" color="gray700">
                Your latest edits haven't been written to the linked repositories yet.
              </Text>
            </PendingCallout>
          )}

          <Text size="2" color="gray700">
            {syncsLoaded ? sentence : 'Loading the latest sync...'}
          </Text>

          <div style={{ height: 12 }} />

          {latestSync ? (
            <SkillSyncDetails
              syncId={latestSync.id}
              rail
              logs={shouldShowRepositorySyncLogs(latestSync) ? 'always' : 'never'}
              pollInterval={syncActive ? activePollMs : null}
            />
          ) : (
            <SyncRepositoryStack rows={getRepositoryRows(repositories)} />
          )}
        </AnimateHeight>
      </Section>

      <Footer>
        <Button
          size="2"
          variant={state === 'pending' || state === 'failed' ? undefined : 'outline'}
          loading={syncMarketplace.isLoading}
          success={syncMarketplace.isSuccess}
          disabled={state === 'syncing'}
          onClick={syncNow}
        >
          Sync Now
        </Button>
        <Button
          size="2"
          variant="outline"
          iconLeft={<RiHistoryLine />}
          onClick={openSyncHistory}
        >
          History
        </Button>
      </Footer>

      <syncMarketplace.RenderError />
    </Card>
  );
};
