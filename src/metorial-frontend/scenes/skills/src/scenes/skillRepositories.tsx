import { renderWithPagination } from '@metorial/data-hooks';
import { showScmRepositoryPicker } from '@metorial/scene-scm';
import {
  allSkillMarketplacePluginsLoader,
  skillMarketplaceLoader,
  type SkillMarketplaceRepository,
  type SkillPluginRepository,
  useCreateSkillMarketplaceRepository,
  useCreateSkillPluginRepository,
  useCurrentOrganization,
  useCurrentProject,
  useDeleteSkillMarketplaceRepository,
  useDeleteSkillPluginRepository,
  useSkillMarketplaceRepositories,
  useSkillPluginRepositories
} from '@metorial/state';
import { Badge, Button, Menu, RenderDate, Text, confirm, theme } from '@metorial/ui';
import { Box, Table } from '@metorial/ui-product';
import { RiAddLine, RiMore2Line } from '@remixicon/react';
import type { ReactNode } from 'react';
import { useMemo } from 'react';
import styled from 'styled-components';

type LinkedRepository = SkillPluginRepository | SkillMarketplaceRepository;

let EmptyState = styled.div`
  line-height: 1.6;
  padding: 8px 0;
`;

let RepoName = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  padding: 5px 0;
`;

let RepoUrl = styled.a`
  color: ${theme.colors.gray600};
  font-size: 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-decoration: none;

  &:hover {
    text-decoration: underline;
  }
`;

let Actions = styled.div`
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: flex-end;
`;

let ContentActions = styled.div`
  display: flex;
  justify-content: flex-end;
  margin-bottom: 12px;
`;

let formatRepoProvider = (provider: 'github' | 'gitlab' | 'bitbucket' | undefined) => {
  if (provider === 'github') return 'GitHub';
  if (provider === 'gitlab') return 'GitLab';
  if (provider === 'bitbucket') return 'Bitbucket';
  return 'Repository';
};

let getRepositoryLabel = (url: string | null | undefined, fallback: string) => {
  if (!url) return fallback;

  try {
    let parsed = new URL(url);
    return parsed.pathname.replace(/^\/+/, '') || fallback;
  } catch {
    return fallback;
  }
};

let useManageSourceControl = () => {
  let organization = useCurrentOrganization();
  let project = useCurrentProject();

  return () => {
    if (!organization.data || !project.data) return;
    window.location.href = `/o/${organization.data.slug}/project/${project.data.slug}/scm`;
  };
};

let getRepositoryTableRow = (p: {
  repository: LinkedRepository;
  isDeleting: boolean;
  onRemove: () => void;
}) => {
  let repo = p.repository.repository;
  let label = getRepositoryLabel(repo.url, repo.name);

  return {
    data: [
      <RepoName>
        <Text size="2" weight="strong">
          {label}
        </Text>
        {repo.url && (
          <RepoUrl href={repo.url} target="_blank" rel="noreferrer">
            {repo.url}
          </RepoUrl>
        )}
      </RepoName>,
      <Text size="2">{formatRepoProvider(repo.provider)}</Text>,
      <Text size="2">{repo.defaultBranch || '-'}</Text>,
      <Badge color={repo.isPrivate ? 'gray' : 'blue'} size="1">
        {repo.isPrivate ? 'Private' : 'Public'}
      </Badge>,
      <RenderDate date={p.repository.createdAt} />,
      <Actions onClick={e => e.stopPropagation()}>
        <Menu
          items={[{ id: 'remove', label: 'Unlink' }]}
          onItemClick={item => {
            if (item !== 'remove') return;
            confirm({
              title: `Unlink ${label}?`,
              description: 'This removes the repository link from this skill resource.',
              confirmText: 'Unlink',
              onConfirm: p.onRemove
            });
          }}
        >
          <Button
            size="1"
            variant="outline"
            iconRight={<RiMore2Line />}
            loading={p.isDeleting}
            title="Repository options"
          />
        </Menu>
      </Actions>
    ]
  };
};

export let SkillPluginRepositoriesSettingsBox = (p: {
  instanceId: string | null | undefined;
  skillPluginId: string | null | undefined;
}) => {
  let manageSourceControl = useManageSourceControl();
  let repositories = useSkillPluginRepositories(p.instanceId, p.skillPluginId, {
    order: 'asc'
  });
  let createRepository = useCreateSkillPluginRepository();
  let deleteRepository = useDeleteSkillPluginRepository();
  let linkedRepositoryIdentifiers = useMemo(
    () =>
      repositories.data?.items.map(item =>
        getRepositoryLabel(item.repository.url, item.repository.name)
      ) ?? [],
    [repositories.data?.items]
  );

  let openPicker = () => {
    if (!p.instanceId || !p.skillPluginId) return;

    showScmRepositoryPicker({
      instanceId: p.instanceId,
      excludedRepositoryIdentifiers: linkedRepositoryIdentifiers,
      allowCreate: true,
      title: 'Link repository',
      description: 'Select or create a Git repository, then link it to this skill plugin.',
      onManageSourceControl: manageSourceControl,
      onSelect: async repo => {
        let [created] = await createRepository.mutate({
          instanceId: p.instanceId!,
          skillPluginId: p.skillPluginId!,
          repoId: repo.id
        });
        if (created) await repositories.refetch();
      }
    });
  };

  let removeRepository = async (repository: SkillPluginRepository) => {
    if (!p.instanceId || !p.skillPluginId) return;

    let [deleted] = await deleteRepository.mutate({
      instanceId: p.instanceId,
      skillPluginId: p.skillPluginId,
      skillPluginRepositoryId: repository.id
    });
    if (deleted) await repositories.refetch();
  };

  return (
    <RepositoriesBox
      repositories={repositories}
      createError={<createRepository.RenderError />}
      deleteError={<deleteRepository.RenderError />}
      isDeleting={deleteRepository.isLoading}
      onOpenPicker={openPicker}
      onRemove={repository => removeRepository(repository as SkillPluginRepository)}
    />
  );
};

export let SkillMarketplaceRepositoriesSettingsBox = (p: {
  instanceId: string | null | undefined;
  skillMarketplaceId: string | null | undefined;
  onChange?: () => void | Promise<void>;
}) => {
  let manager = useSkillMarketplaceRepositoriesManager(p);

  return (
    <Box
      title="Repositories"
      description="Link repositories used to source and sync this skill resource."
      rightActions={
        <Button
          size="2"
          iconLeft={<RiAddLine />}
          onClick={manager.openPicker}
          variant="outline"
        >
          Link Repository
        </Button>
      }
    >
      <SkillMarketplaceRepositoriesSettingsContent manager={manager} />
    </Box>
  );
};

export let useSkillMarketplaceRepositoriesManager = (p: {
  instanceId: string | null | undefined;
  skillMarketplaceId: string | null | undefined;
  onChange?: () => void | Promise<void>;
}) => {
  let manageSourceControl = useManageSourceControl();
  let repositories = useSkillMarketplaceRepositories(p.instanceId, p.skillMarketplaceId, {
    order: 'asc'
  });
  let createRepository = useCreateSkillMarketplaceRepository();
  let deleteRepository = useDeleteSkillMarketplaceRepository();
  let linkedRepositoryIdentifiers = useMemo(
    () =>
      repositories.data?.items.map(item =>
        getRepositoryLabel(item.repository.url, item.repository.name)
      ) ?? [],
    [repositories.data?.items]
  );

  let openPicker = () => {
    if (!p.instanceId || !p.skillMarketplaceId) return;

    showScmRepositoryPicker({
      instanceId: p.instanceId,
      excludedRepositoryIdentifiers: linkedRepositoryIdentifiers,
      allowCreate: true,
      title: 'Link repository',
      description:
        'Select or create a Git repository, then link it to this skill marketplace.',
      onManageSourceControl: manageSourceControl,
      onClose: () => {
        repositories.refetch();
        void p.onChange?.();
        if (p.instanceId && p.skillMarketplaceId) {
          skillMarketplaceLoader.fetch(
            { instanceId: p.instanceId, skillMarketplaceId: p.skillMarketplaceId },
            { force: true }
          );
        }
        allSkillMarketplacePluginsLoader.refetchAll();
      },
      onSelect: async repo => {
        let [created] = await createRepository.mutate({
          instanceId: p.instanceId!,
          skillMarketplaceId: p.skillMarketplaceId!,
          repoId: repo.id
        });
        if (created) {
          await repositories.refetch();
          await p.onChange?.();
        }
      }
    });
  };

  let removeRepository = async (repository: SkillMarketplaceRepository) => {
    if (!p.instanceId || !p.skillMarketplaceId) return;

    let [deleted] = await deleteRepository.mutate({
      instanceId: p.instanceId,
      skillMarketplaceId: p.skillMarketplaceId,
      skillMarketplaceRepositoryId: repository.id
    });
    if (deleted) {
      await repositories.refetch();
      await p.onChange?.();
    }
  };

  return {
    repositories,
    createRepository,
    deleteRepository,
    openPicker,
    removeRepository
  };
};

export let SkillMarketplaceRepositoriesSettingsContent = (p: {
  manager: ReturnType<typeof useSkillMarketplaceRepositoriesManager>;
  showLinkAction?: boolean;
}) => {
  let manager = p.manager;

  return (
    <>
      {p.showLinkAction && (
        <ContentActions>
          <Button
            size="2"
            iconLeft={<RiAddLine />}
            onClick={manager.openPicker}
            variant="outline"
          >
            Link Repository
          </Button>
        </ContentActions>
      )}

      {renderWithPagination(manager.repositories, { hidePaginationWhenUnavailable: true })(
        repositories =>
          repositories.data.items.length === 0 ? (
            <EmptyState>
              <Text color="gray600" size="2">
                No repositories are linked yet.
              </Text>
            </EmptyState>
          ) : (
            <Table
              headers={['Repository', 'Provider', 'Branch', 'Visibility', 'Linked', '']}
              data={repositories.data.items.map(repository =>
                getRepositoryTableRow({
                  repository,
                  isDeleting: manager.deleteRepository.isLoading,
                  onRemove: () => manager.removeRepository(repository)
                })
              )}
            />
          )
      )}

      <manager.createRepository.RenderError />
      <manager.deleteRepository.RenderError />
    </>
  );
};

export let SkillMarketplaceRepositoriesSettingsContentScene = (p: {
  instanceId: string | null | undefined;
  skillMarketplaceId: string | null | undefined;
  showLinkAction?: boolean;
  onChange?: () => void | Promise<void>;
}) => {
  let manager = useSkillMarketplaceRepositoriesManager(p);
  return (
    <SkillMarketplaceRepositoriesSettingsContent
      manager={manager}
      showLinkAction={p.showLinkAction}
    />
  );
};

let RepositoriesBox = (p: {
  repositories: any;
  createError: ReactNode;
  deleteError: ReactNode;
  isDeleting: boolean;
  onOpenPicker: () => void;
  onRemove: (repository: LinkedRepository) => void;
}) => {
  return (
    <Box
      title="Repositories"
      description="Link repositories used to source and sync this skill resource."
      rightActions={
        <Button size="2" iconLeft={<RiAddLine />} onClick={p.onOpenPicker} variant="outline">
          Link Repository
        </Button>
      }
    >
      {renderWithPagination(p.repositories, { hidePaginationWhenUnavailable: true })(
        repositories =>
          repositories.data.items.length === 0 ? (
            <EmptyState>
              <Text color="gray600" size="2">
                No repositories are linked yet.
              </Text>
            </EmptyState>
          ) : (
            <Table
              headers={['Repository', 'Provider', 'Branch', 'Visibility', 'Linked', '']}
              data={repositories.data.items.map((repository: LinkedRepository) =>
                getRepositoryTableRow({
                  repository,
                  isDeleting: p.isDeleting,
                  onRemove: () => p.onRemove(repository)
                })
              )}
            />
          )
      )}

      {p.createError}
      {p.deleteError}
    </Box>
  );
};
