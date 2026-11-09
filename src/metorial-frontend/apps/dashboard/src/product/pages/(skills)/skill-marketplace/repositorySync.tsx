import { renderWithLoader } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import {
  SkillMarketplaceRepositoriesSettingsBox,
  SkillMarketplaceRepositoriesSettingsContentScene,
  SkillMarketplaceRepositoryAccessSettings,
  useSkillMarketplaceRepositoriesManager
} from '@metorial/scene-skills';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useSkillMarketplace,
  useSkillSyncs
} from '@metorial/state';
import { Button, Dialog, Flex, Menu, Spacer, Text, showModal } from '@metorial/ui';
import { Box } from '@metorial/ui-product';
import { RiMore2Line } from '@remixicon/react';
import { useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useInterval } from 'react-use';
import { SkillSyncDetails } from '../skillSyncs';
import { getSyncStatusMessage } from './repositorySyncMessage';
import { shouldShowRepositorySyncLogs } from './repositorySyncVisibility';

let showRepositoryAccessSettings = (
  p: {
    instanceId: string | null | undefined;
    skillMarketplaceId: string | null | undefined;
  },
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
  p: {
    instanceId: string | null | undefined;
    skillMarketplaceId: string | null | undefined;
  },
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

export let SkillMarketplaceRepositorySyncBox = (p: {
  skillMarketplaceId: string | null | undefined;
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
  let syncDataCacheRef = useRef<{
    skillMarketplaceId: string | null | undefined;
    data: typeof syncs.data;
  }>({ skillMarketplaceId: p.skillMarketplaceId, data: syncs.data });
  if (syncDataCacheRef.current.skillMarketplaceId !== p.skillMarketplaceId) {
    syncDataCacheRef.current = { skillMarketplaceId: p.skillMarketplaceId, data: null };
  }
  if (syncs.data) syncDataCacheRef.current.data = syncs.data;
  let stableSyncData = syncs.data ?? syncDataCacheRef.current.data;
  let stableSyncs = {
    ...syncs,
    data: stableSyncData,
    isLoading: syncs.isLoading && !stableSyncData,
    error: stableSyncData ? null : syncs.error
  };
  let refreshRepositorySyncBox = () =>
    Promise.all([syncs.refetch(), marketplace.refetch()]).then(() => {});
  let repositoryManager = useSkillMarketplaceRepositoriesManager({
    instanceId: instance.data?.id,
    skillMarketplaceId: p.skillMarketplaceId,
    onChange: refreshRepositorySyncBox
  });
  let settingsProps = {
    instanceId: instance.data?.id,
    skillMarketplaceId: p.skillMarketplaceId
  };
  let repositories = repositoryManager.repositories.data?.items ?? [];

  useInterval(() => syncs.refetch(), repositories.length > 0 ? 5_000 : null);

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

  let forceSync = async () => {
    let [synced] = await syncMarketplace.mutate({});
    if (synced) await syncs.refetch();
  };

  if (repositories.length === 0) {
    return (
      <SkillMarketplaceRepositoriesSettingsBox
        {...settingsProps}
        onChange={refreshRepositorySyncBox}
      />
    );
  }

  return (
    <Box
      title="Repository Sync"
      description="Monitor the latest repository sync and resolve anything that needs attention."
      rightActions={
        <Flex gap="8px">
          {marketplace.data?.syncStatus === 'pending' && (
            <Button size="2" loading={syncMarketplace.isLoading} onClick={forceSync}>
              Sync Now
            </Button>
          )}
          <Menu
            items={[
              { id: 'link', label: 'Link Repository' },
              { id: 'access', label: 'Repository Sync Settings' },
              { id: 'manage', label: 'Manage Repositories' },
              { id: 'history', label: 'Sync History' },
              { id: 'force_sync', label: 'Force Sync' }
            ]}
            onItemClick={item => {
              if (item === 'force_sync') forceSync();
              if (item === 'link') repositoryManager.openPicker();
              if (item === 'access') {
                showRepositoryAccessSettings(settingsProps, refreshRepositorySyncBox);
              }
              if (item === 'manage') {
                showManageRepositories(settingsProps, refreshRepositorySyncBox);
              }
              if (item === 'history') openSyncHistory();
            }}
          >
            <Button size="2" variant="outline" iconRight={<RiMore2Line />} />
          </Menu>
        </Flex>
      }
    >
      {renderWithLoader({ syncs: stableSyncs })(({ syncs }) => {
        let latestSync = syncs.data.items[0];
        if (!latestSync) {
          return (
            <Text color="gray600" size="2">
              No repository sync has completed or required attention yet.
            </Text>
          );
        }

        return (
          <>
            <Text size="2">{getSyncStatusMessage(latestSync, repositories)}</Text>

            <Spacer height={16} />

            <SkillSyncDetails
              syncId={latestSync.id}
              compact
              logs={shouldShowRepositorySyncLogs(latestSync) ? 'always' : 'never'}
              pollInterval={5_000}
            />
          </>
        );
      })}
    </Box>
  );
};
