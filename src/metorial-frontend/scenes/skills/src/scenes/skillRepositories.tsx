import type { DashboardInstanceScmReposCreateOutput } from '@metorial/dashboard-sdk';
import { renderWithLoader, renderWithPagination } from '@metorial/data-hooks';
import {
  type SkillMarketplaceRepository,
  type SkillPluginRepository,
  useCreateScmInstallation,
  useCreateScmRepo,
  useCreateSkillMarketplaceRepository,
  useCreateSkillPluginRepository,
  useDeleteSkillMarketplaceRepository,
  useDeleteSkillPluginRepository,
  useScmAccounts,
  useScmInstallations,
  useScmRepos,
  useSkillMarketplaceRepositories,
  useSkillPluginRepositories
} from '@metorial/state';
import {
  Badge,
  Button,
  Dialog,
  Flex,
  Input,
  Menu,
  RenderDate,
  Select,
  Spacer,
  Text,
  confirm,
  showModal,
  theme,
  toast
} from '@metorial/ui';
import { Box, Table } from '@metorial/ui-product';
import { RiAddLine, RiMore2Line } from '@remixicon/react';
import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
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

let RepoBox = styled.div`
  max-height: 320px;
  border: ${theme.colors.gray400} 1px solid;
  display: flex;
  flex-direction: column;
  border-radius: 14px;
  overflow: auto;
  position: relative;
`;

let RepoSearch = styled.div`
  position: sticky;
  top: 0;
  background: ${theme.colors.background};
  padding: 10px;
  border-bottom: ${theme.colors.gray400} 1px solid;
  z-index: 3;
`;

let RepoList = styled.div`
  display: flex;
  flex-direction: column;
`;

let RepoItem = styled.button`
  padding: 15px 20px;
  background: ${theme.colors.background};
  cursor: pointer;
  text-align: left;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border: none;
  gap: 12px;

  h3 {
    font-size: 14px;
    font-weight: 600;
  }

  p {
    font-size: 10px;
    color: ${theme.colors.gray700};
    font-weight: 500;
  }

  main {
    display: flex;
    flex-direction: column;
    gap: 3px;
    min-width: 0;
  }

  &:not(:last-child) {
    border-bottom: ${theme.colors.gray400} 1px solid;
  }
`;

let FormStack = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

let formatRepoProvider = (provider: 'github' | 'gitlab' | undefined) => {
  if (provider === 'github') return 'GitHub';
  if (provider === 'gitlab') return 'GitLab';
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

let ConnectGitHubButton = (p: { instanceId: string; onConnected: () => void }) => {
  let createInstallation = useCreateScmInstallation();

  return (
    <Button
      onClick={async () => {
        let [res] = await createInstallation.mutate({
          instanceId: p.instanceId,
          redirectUrl: window.location.href
        });

        if (!res?.url) return;

        let toastShownRef = { current: false };
        let handleMessage = (msg: MessageEvent) => {
          if (msg.data?.type !== 'scm_complete') return;

          p.onConnected();

          if (!toastShownRef.current) {
            toast.success('GitHub connected successfully');
            toastShownRef.current = true;
          }

          window.removeEventListener('message', handleMessage);
        };

        window.addEventListener('message', handleMessage);
        window.open(res.url, '_blank');
      }}
      loading={createInstallation.isLoading}
      size="3"
      fullWidth
      type="button"
    >
      Connect GitHub
    </Button>
  );
};

let RepositoryPickerContent = (p: {
  instanceId: string;
  linkedRepoIds: string[];
  onSelect: (repo: DashboardInstanceScmReposCreateOutput) => Promise<void> | void;
}) => {
  let installations = useScmInstallations(p.instanceId);
  let installationsOuter = installations;
  let createRepo = useCreateScmRepo();
  let [repoSearch, setRepoSearch] = useState('');
  let [createRepoName, setCreateRepoName] = useState('');
  let [createRepoIsPrivate, setCreateRepoIsPrivate] = useState(true);
  let [selectedInstallationId, setSelectedInstallationId] = useState<string | undefined>(
    undefined
  );

  useEffect(() => {
    if (installations.data?.items.length && !selectedInstallationId) {
      setSelectedInstallationId(installations.data.items[0].id);
    }
  }, [installations.data?.items, selectedInstallationId]);

  let accounts = useScmAccounts(
    p.instanceId,
    selectedInstallationId ? { installationId: selectedInstallationId } : undefined
  );
  let accountItems = (accounts.data?.accounts ?? []).filter(Boolean);
  let [selectedAccountId, setSelectedAccountId] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (
      accountItems.length &&
      (!selectedAccountId || !accountItems.some(item => item.externalId === selectedAccountId))
    ) {
      setSelectedAccountId(accountItems[0].externalId);
    }
  }, [accountItems, selectedAccountId]);

  let repos = useScmRepos(
    p.instanceId,
    selectedInstallationId && selectedAccountId
      ? {
          installationId: selectedInstallationId,
          externalAccountId: selectedAccountId
        }
      : undefined
  );
  let linkedRepoIds = useMemo(() => new Set(p.linkedRepoIds), [p.linkedRepoIds]);

  let createRepository = async () => {
    if (!selectedInstallationId || !selectedAccountId || !createRepoName.trim()) return;

    let [res] = await createRepo.mutate({
      instanceId: p.instanceId,
      installationId: selectedInstallationId,
      externalAccountId: selectedAccountId,
      name: createRepoName.trim(),
      isPrivate: createRepoIsPrivate
    });

    if (res) await p.onSelect(res);
  };

  return renderWithLoader({ installations })(({ installations }) => (
    <>
      {!installations.data.items.length ? (
        <ConnectGitHubButton
          instanceId={p.instanceId}
          onConnected={() => {
            installationsOuter.refetch();
          }}
        />
      ) : (
        renderWithLoader({ accounts, repos })(({ repos }) => (
          <FormStack>
            {installations.data.items.length > 1 && (
              <Select
                label="GitHub Installation"
                items={installations.data.items.map(i => ({
                  label:
                    i.externalAccount.name ??
                    i.externalAccount.email ??
                    i.externalAccount.login,
                  id: i.id
                }))}
                value={selectedInstallationId}
                onChange={v => {
                  setSelectedInstallationId(v);
                  setSelectedAccountId(undefined);
                }}
              />
            )}

            {accountItems.length > 0 && (
              <Select
                label="GitHub Account"
                items={accountItems.map(i => ({
                  label: i.name,
                  id: i.externalId
                }))}
                value={selectedAccountId}
                onChange={v => setSelectedAccountId(v)}
              />
            )}

            <RepoBox>
              <RepoSearch>
                <Input
                  label="Search Repositories"
                  hideLabel
                  placeholder="Search repositories..."
                  value={repoSearch}
                  onChange={e => setRepoSearch(e.target.value)}
                />
              </RepoSearch>

              <RepoList>
                {repos.data.repos
                  .filter(repo => !linkedRepoIds.has(repo.externalId))
                  .filter(
                    repo =>
                      repoSearch.trim() === '' ||
                      repo.name.toLowerCase().includes(repoSearch.toLowerCase()) ||
                      repo.identifier.toLowerCase().includes(repoSearch.toLowerCase())
                  )
                  .map(repo => (
                    <RepoItem
                      key={repo.externalId}
                      type="button"
                      disabled={createRepo.isLoading}
                      onClick={async () => {
                        let [res] = await createRepo.mutate({
                          instanceId: p.instanceId,
                          installationId: selectedInstallationId!,
                          externalRepoId: repo.externalId
                        });

                        if (res) await p.onSelect(res);
                      }}
                    >
                      <main>
                        <h3>{repo.identifier}</h3>
                        <p>{formatRepoProvider(repo.provider)}</p>
                      </main>

                      <Button
                        size="2"
                        variant="soft"
                        as="div"
                        loading={
                          !!(
                            createRepo.isLoading &&
                            createRepo.input &&
                            'externalRepoId' in createRepo.input &&
                            createRepo.input.externalRepoId === repo.externalId
                          )
                        }
                      >
                        Import
                      </Button>
                    </RepoItem>
                  ))}

                {repos.data.repos.length === 0 && (
                  <EmptyState>
                    <Text color="gray600" size="2">
                      No repositories found.
                    </Text>
                  </EmptyState>
                )}
              </RepoList>
            </RepoBox>

            <Spacer size={5} />

            <FormStack>
              <Text size="2" weight="strong">
                Create Repository
              </Text>

              <Input
                label="Repository Name"
                placeholder="e.g. my-repo"
                value={createRepoName}
                onChange={e => setCreateRepoName(e.target.value)}
              />

              <Select
                label="Repository Visibility"
                items={[
                  { label: 'Private', id: 'private' },
                  { label: 'Public', id: 'public' }
                ]}
                value={createRepoIsPrivate ? 'private' : 'public'}
                onChange={v => setCreateRepoIsPrivate(v === 'private')}
              />

              <Flex justify="end">
                <Button
                  size="2"
                  disabled={
                    !selectedInstallationId || !selectedAccountId || !createRepoName.trim()
                  }
                  loading={
                    !!(createRepo.isLoading && createRepo.input && 'name' in createRepo.input)
                  }
                  onClick={createRepository}
                >
                  Create and Link
                </Button>
              </Flex>
            </FormStack>

            <createRepo.RenderError />
          </FormStack>
        ))
      )}
    </>
  ));
};

let showRepositoryPickerModal = (p: {
  instanceId: string;
  linkedRepoIds: string[];
  onSelect: (repo: DashboardInstanceScmReposCreateOutput) => Promise<void> | void;
}) =>
  showModal(({ dialogProps, close }) => (
    <Dialog.Wrapper {...dialogProps} width={500}>
      <Dialog.Title>Link Repository</Dialog.Title>
      <Dialog.Description>
        Select or create a Git repository, then link it to this skill resource.
      </Dialog.Description>

      <Spacer size={15} />

      <RepositoryPickerContent
        {...p}
        onSelect={async repo => {
          await p.onSelect(repo);
          close();
        }}
      />

      <Spacer size={15} />

      <Dialog.Actions>
        <Button variant="soft" onClick={close} size="2">
          Close
        </Button>
      </Dialog.Actions>
    </Dialog.Wrapper>
  ));

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
  let repositories = useSkillPluginRepositories(p.instanceId, p.skillPluginId, {
    order: 'asc'
  });
  let createRepository = useCreateSkillPluginRepository();
  let deleteRepository = useDeleteSkillPluginRepository();
  let linkedRepoIds = useMemo(
    () => repositories.data?.items.map(item => item.repoId) ?? [],
    [repositories.data?.items]
  );

  let openPicker = () => {
    if (!p.instanceId || !p.skillPluginId) return;

    showRepositoryPickerModal({
      instanceId: p.instanceId,
      linkedRepoIds,
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
}) => {
  let repositories = useSkillMarketplaceRepositories(p.instanceId, p.skillMarketplaceId, {
    order: 'asc'
  });
  let createRepository = useCreateSkillMarketplaceRepository();
  let deleteRepository = useDeleteSkillMarketplaceRepository();
  let linkedRepoIds = useMemo(
    () => repositories.data?.items.map(item => item.repoId) ?? [],
    [repositories.data?.items]
  );

  let openPicker = () => {
    if (!p.instanceId || !p.skillMarketplaceId) return;

    showRepositoryPickerModal({
      instanceId: p.instanceId,
      linkedRepoIds,
      onSelect: async repo => {
        let [created] = await createRepository.mutate({
          instanceId: p.instanceId!,
          skillMarketplaceId: p.skillMarketplaceId!,
          repoId: repo.id
        });
        if (created) await repositories.refetch();
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
    if (deleted) await repositories.refetch();
  };

  return (
    <RepositoriesBox
      repositories={repositories}
      createError={<createRepository.RenderError />}
      deleteError={<deleteRepository.RenderError />}
      isDeleting={deleteRepository.isLoading}
      onOpenPicker={openPicker}
      onRemove={repository => removeRepository(repository as SkillMarketplaceRepository)}
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
