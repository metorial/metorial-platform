import type { DashboardInstanceScmReposCreateOutput } from '@metorial/dashboard-sdk';
import { renderWithLoader } from '@metorial/data-hooks';
import {
  useCreateScmInstallation,
  useCreateScmProvider,
  useCreateScmRepo,
  useResolveScmRepository,
  useScmAccounts,
  useScmInstallations,
  useScmRepos
} from '@metorial/state';
import {
  Avatar,
  Button,
  Flex,
  Input,
  Menu,
  Panel,
  Popover,
  Select,
  Spacer,
  Text,
  showModal,
  theme,
  toast
} from '@metorial/ui';
import {
  RiAddLine,
  RiArrowDownSLine,
  RiArrowLeftLine,
  RiCheckLine,
  RiExternalLinkLine,
  RiGitRepositoryLine,
  RiSettings3Line
} from '@remixicon/react';
import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import styled from 'styled-components';
import {
  type ScmAccountSelection,
  type ScmInstallation,
  type ScmRepositoryPreview,
  filterScmRepositories,
  formatScmProvider,
  getInstallationName,
  makeScmAccountSelection,
  parsePublicScmRepositoryUrl
} from './utils';

let PickerContent = styled.div`
  min-height: calc(100vh - 76px);
  display: flex;
  flex-direction: column;
`;

let SectionLabel = styled.div`
  color: ${theme.colors.gray600};
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.055em;
  margin-bottom: 7px;
`;

let AccountTrigger = styled.button`
  width: 100%;
  min-height: 68px;
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 12px;
  padding: 11px 13px;
  border: 1px solid ${theme.colors.gray400};
  border-radius: 10px;
  background: ${theme.colors.background};
  cursor: pointer;
  text-align: left;

  &:hover,
  &:focus-visible {
    border-color: ${theme.colors.gray600};
    background: ${theme.colors.gray100};
    outline: none;
  }
`;

let ProviderIcon = styled.div<{ $provider: string; $small?: boolean }>`
  width: ${({ $small }) => ($small ? 34 : 40)}px;
  height: ${({ $small }) => ($small ? 34 : 40)}px;
  display: grid;
  place-items: center;
  flex: none;
  border-radius: 9px;
  color: white;
  background: ${({ $provider }) =>
    $provider == 'github' ? '#24292f' : $provider == 'gitlab' ? '#7750c9' : '#0c66e4'};
  font-size: ${({ $small }) => ($small ? 11 : 12)}px;
  font-weight: 750;
`;

let AccountAvatarStack = styled.div`
  position: relative;
  width: 40px;
  height: 40px;
  flex: none;
`;

let InstallationAvatar = styled.div`
  position: absolute;
  right: -3px;
  bottom: -3px;
  width: 18px;
  height: 18px;
  overflow: hidden;
  border: 2px solid ${theme.colors.background};
  border-radius: 6px;
  background: ${theme.colors.gray200};
`;

let AccountName = styled.div`
  min-width: 0;
  overflow: hidden;
  color: ${theme.colors.foreground};
  font-size: 14px;
  font-weight: 650;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

let AccountMeta = styled.div`
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 4px;
  color: ${theme.colors.gray600};
  font-size: 12px;
`;

let AccountMenu = styled.div`
  width: min(600px, calc(100vw - 50px));
  max-height: min(540px, var(--radix-popover-content-available-height));
  overflow-y: auto;
  overscroll-behavior: contain;
`;

let AccountMenuTitle = styled.div`
  padding: 3px 4px 8px;
  color: ${theme.colors.gray600};
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.055em;
`;

let AccountOption = styled.button<{ $selected: boolean }>`
  width: 100%;
  min-height: 56px;
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 11px;
  padding: 8px;
  border: 0;
  border-radius: 8px;
  background: ${({ $selected }) =>
    $selected ? `${theme.colors.gray400} !important` : 'transparent'};
  cursor: pointer;
  text-align: left;
  transition: all 0.2s ease-in-out;

  &:hover,
  &:focus-visible {
    background: ${theme.colors.gray300};
    outline: none;
  }
`;

let AccountLoading = styled.div`
  padding: 10px;
  color: ${theme.colors.gray600};
  font-size: 12px;
`;

let AccountMenuActions = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  padding-top: 10px;
  margin-top: 8px;
  border-top: 1px solid ${theme.colors.gray300};
`;

let SearchRow = styled.div`
  display: flex;
  align-items: end;
  gap: 8px;
  margin-top: 10px;

  > :first-child {
    flex: 1;
    min-width: 0;
  }
`;

let ResultMeta = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin: 14px 0 8px;
`;

let RepoList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 7px;
  padding-bottom: 20px;
`;

let RepoItem = styled.button<{ $selected: boolean }>`
  width: 100%;
  min-height: 66px;
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 12px;
  padding: 10px 11px;
  border: 1px solid
    ${({ $selected }) => ($selected ? theme.colors.blue700 : theme.colors.gray300)};
  border-radius: 9px;
  background: ${({ $selected }) =>
    $selected ? theme.colors.blue100 : theme.colors.background};
  cursor: pointer;
  text-align: left;

  &:hover,
  &:focus-visible {
    border-color: ${theme.colors.gray600};
    background: ${theme.colors.gray100};
    outline: none;
  }
`;

let RepoIcon = styled.div`
  width: 35px;
  height: 35px;
  display: grid;
  place-items: center;
  border-radius: 7px;
  color: ${theme.colors.gray700};
  background: rgba(0, 0, 0, 0.03);
`;

let RepoTitle = styled.div`
  overflow: hidden;
  font-size: 14px;
  font-weight: 650;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

let RepoMeta = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 5px;
  color: ${theme.colors.gray600};
  font-size: 11px;
`;

let EmptyState = styled.div`
  padding: 15px 20px;
  border: 1px dashed ${theme.colors.gray400};
  border-radius: 9px;
  text-align: center;
`;

let PublicRepositoryItem = styled.div`
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 12px;
  padding: 10px 11px;
  margin-top: 12px;
  border: 1px solid ${theme.colors.blue500};
  border-radius: 9px;
  background: ${theme.colors.blue100};
`;

let ConnectState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 420px;
  padding: 40px;
  text-align: center;
`;

let ConnectIcon = styled.div`
  width: 46px;
  height: 46px;
  display: grid;
  place-items: center;
  margin-bottom: 15px;
  border: 1px solid ${theme.colors.gray300};
  border-radius: 12px;
  background: ${theme.colors.gray100};
`;

let CreateCard = styled.div`
  padding: 20px;
  border: 1px solid ${theme.colors.gray300};
  border-radius: 10px;
  background: ${theme.colors.gray100};
`;

let BackButton = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 0;
  margin-bottom: 20px;
  border: 0;
  color: ${theme.colors.gray700};
  background: transparent;
  cursor: pointer;
  font-size: 12px;
  font-weight: 600;
`;

let Footer = styled.footer`
  position: sticky;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 20px;
  margin: auto -20px -20px;
  border-top: 1px solid ${theme.colors.gray300};
  background: ${theme.colors.gray100};
`;

let getProviderInitials = (provider: string) =>
  provider == 'github' ? 'GH' : provider == 'gitlab' ? 'GL' : 'BB';

let AccountAvatar = (p: {
  name: string;
  imageUrl?: string | null;
  installationName?: string;
  installationImageUrl?: string | null;
  provider: string;
  size?: 34 | 40;
  showInstallation?: boolean;
}) => {
  let size = p.size ?? 40;
  let avatar = p.imageUrl ? (
    <Avatar entity={{ name: p.name, imageUrl: p.imageUrl }} size={size} radius={9} noTooltip />
  ) : (
    <ProviderIcon $provider={p.provider} $small={size == 34}>
      {getProviderInitials(p.provider)}
    </ProviderIcon>
  );

  if (!p.showInstallation || !p.installationImageUrl) return avatar;

  return (
    <AccountAvatarStack>
      {avatar}
      <InstallationAvatar>
        <Avatar
          entity={{
            name: p.installationName ?? 'Source control connection',
            imageUrl: p.installationImageUrl
          }}
          size={14}
          radius={4}
          noTooltip
        />
      </InstallationAvatar>
    </AccountAvatarStack>
  );
};

let InstallationAccounts = (p: {
  instanceId: string;
  installation: ScmInstallation;
  selected: ScmAccountSelection | null;
  autoSelect: boolean;
  onSelect: (account: ScmAccountSelection) => void;
}) => {
  let accounts = useScmAccounts(p.instanceId, { installationId: p.installation.id });
  let firstAccount = accounts.data?.accounts[0];

  useEffect(() => {
    if (!p.autoSelect || p.selected || !firstAccount) return;
    p.onSelect(makeScmAccountSelection(p.installation, firstAccount));
  }, [firstAccount, p.autoSelect, p.selected]);

  if (accounts.isLoading && !accounts.data) {
    return <AccountLoading>Loading {getInstallationName(p.installation)}…</AccountLoading>;
  }

  if (accounts.error) {
    return <AccountLoading>Could not load accounts for this connection.</AccountLoading>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {(accounts.data?.accounts ?? []).map(account => {
        let selection = makeScmAccountSelection(p.installation, account);
        let isSelected =
          p.selected?.installationId == selection.installationId &&
          p.selected?.externalAccountId == selection.externalAccountId;

        return (
          <AccountOption
            key={`${p.installation.id}:${account.externalId}`}
            type="button"
            $selected={isSelected}
            onClick={() => p.onSelect(selection)}
          >
            <AccountAvatar
              name={account.name}
              imageUrl={account.imageUrl}
              provider={account.provider}
              size={34}
            />

            <div style={{ minWidth: 0 }}>
              <AccountName>{account.name}</AccountName>
              <AccountMeta>
                {formatScmProvider(account.provider)} · {account.identifier}
                {p.installation.externalAccount.login != account.identifier
                  ? ` · via ${getInstallationName(p.installation)}`
                  : ''}
              </AccountMeta>
            </div>

            {isSelected && <RiCheckLine size={18} />}
          </AccountOption>
        );
      })}
    </div>
  );
};

let InstallationAccountAutoSelect = (p: {
  instanceId: string;
  installation: ScmInstallation;
  selected: ScmAccountSelection | null;
  onSelect: (account: ScmAccountSelection) => void;
}) => {
  let accounts = useScmAccounts(p.instanceId, { installationId: p.installation.id });
  let firstAccount = accounts.data?.accounts[0];

  useEffect(() => {
    if (p.selected || !firstAccount) return;
    p.onSelect(makeScmAccountSelection(p.installation, firstAccount));
  }, [firstAccount, p.selected]);

  return null;
};

export type ScmRepositoryPickerProps = {
  instanceId: string;
  excludedExternalRepoIds?: string[];
  excludedRepositoryIdentifiers?: string[];
  selectedExternalRepoId?: string;
  allowCreate?: boolean;
  allowPublicUrl?: boolean;
  onSelect: (
    repository: DashboardInstanceScmReposCreateOutput
  ) => Promise<boolean | void> | boolean | void;
  onSelectPublicUrl?: (url: string) => Promise<boolean | void> | boolean | void;
  selectionError?: ReactNode;
  onManageSourceControl?: () => void;
  close: () => void;
};

export let ScmRepositoryPicker = (p: ScmRepositoryPickerProps) => {
  let installations = useScmInstallations(p.instanceId, { limit: 100, order: 'asc' });
  let installationsOuter = installations;
  let createInstallation = useCreateScmInstallation();
  let createProvider = useCreateScmProvider();
  let createRepo = useCreateScmRepo();
  let resolveRepo = useResolveScmRepository();
  let [selectedAccount, setSelectedAccount] = useState<ScmAccountSelection | null>(null);
  let [accountMenuKey, setAccountMenuKey] = useState('initial');
  let [search, setSearch] = useState('');
  let [previewCursor, setPreviewCursor] = useState<string | undefined>();
  let [loadedRepos, setLoadedRepos] = useState<ScmRepositoryPreview[]>([]);
  let [view, setView] = useState<'repositories' | 'create'>('repositories');
  let [createName, setCreateName] = useState('');
  let [createVisibility, setCreateVisibility] = useState<'private' | 'public'>('private');
  let installationIdsRef = useRef<string[]>([]);

  useEffect(() => {
    let items = installations.data?.items;
    if (!items) return;

    let previousIds = new Set(installationIdsRef.current);
    let added = items.find(item => !previousIds.has(item.id));
    installationIdsRef.current = items.map(item => item.id);

    if (added && previousIds.size > 0) {
      setSelectedAccount(null);
    }
  }, [installations.data?.items]);

  let repos = useScmRepos(
    p.instanceId,
    selectedAccount
      ? {
          installationId: selectedAccount.installationId,
          externalAccountId: selectedAccount.externalAccountId,
          cursor: previewCursor
        }
      : undefined
  );

  useEffect(() => {
    setPreviewCursor(undefined);
    setLoadedRepos([]);
  }, [selectedAccount?.installationId, selectedAccount?.externalAccountId]);

  useEffect(() => {
    let repoPage = repos.data;
    if (!repoPage) return;
    setLoadedRepos(current =>
      previewCursor
        ? [
            ...current,
            ...repoPage.repos.filter(
              repo => !current.some(item => item.externalId == repo.externalId)
            )
          ]
        : repoPage.repos
    );
  }, [repos.data, previewCursor]);

  useEffect(() => {
    if (!repos.data?.nextCursor || repos.isLoading) return;
    setPreviewCursor(repos.data.nextCursor);
  }, [repos.data?.nextCursor, repos.isLoading]);

  let filteredRepos = useMemo(
    () =>
      filterScmRepositories(
        loadedRepos,
        search,
        p.excludedExternalRepoIds ?? [],
        p.excludedRepositoryIdentifiers ?? []
      ),
    [loadedRepos, search, p.excludedExternalRepoIds, p.excludedRepositoryIdentifiers]
  );
  let publicRepository = useMemo(
    () =>
      p.allowPublicUrl && p.onSelectPublicUrl ? parsePublicScmRepositoryUrl(search) : null,
    [p.allowPublicUrl, p.onSelectPublicUrl, search]
  );

  let connect = async () => {
    let [result] = await createInstallation.mutate({
      instanceId: p.instanceId,
      redirectUrl: window.location.href
    });
    if (!result?.url) return;

    let handleMessage = async (event: MessageEvent) => {
      if (event.data?.type != 'scm_complete') return;
      window.removeEventListener('message', handleMessage);
      await installationsOuter.refetch();
      toast.success('Source control connected successfully');
    };

    window.addEventListener('message', handleMessage);
    let popup = window.open(result.url, '_blank');
    popup?.focus();
  };

  let setupProvider = async (
    type: 'github_enterprise' | 'gitlab_selfhosted' | 'bitbucket_data_center'
  ) => {
    let [result] = await createProvider.mutate({ instanceId: p.instanceId, type });
    if (!result?.url) return;
    let popup = window.open(result.url, '_blank');
    popup?.focus();
  };

  let selectRepository = async (externalRepoId: string) => {
    if (!selectedAccount) return;
    let [repository] = await createRepo.mutate({
      instanceId: p.instanceId,
      installationId: selectedAccount.installationId,
      externalRepoId
    });
    if (!repository) return;
    let shouldClose = await p.onSelect(repository);
    if (shouldClose !== false) p.close();
  };

  let createRepository = async () => {
    if (!selectedAccount || !createName.trim()) return;
    let [repository] = await createRepo.mutate({
      instanceId: p.instanceId,
      installationId: selectedAccount.installationId,
      externalAccountId: selectedAccount.externalAccountId,
      name: createName.trim(),
      isPrivate: createVisibility == 'private'
    });
    if (!repository) return;
    let shouldClose = await p.onSelect(repository);
    if (shouldClose !== false) p.close();
  };

  let selectPublicRepository = async () => {
    if (!publicRepository || !p.onSelectPublicUrl) return;

    let [resolved] = await resolveRepo.mutate({
      instanceId: p.instanceId,
      provider: publicRepository.provider,
      identifier: publicRepository.identifier
    });
    if (!resolved) return;

    if (resolved.type == 'linked') {
      let shouldClose = await p.onSelect(resolved.repository);
      if (shouldClose !== false) p.close();
      return;
    }

    if (resolved.type == 'available') {
      let [repository] = await createRepo.mutate({
        instanceId: p.instanceId,
        installationId: resolved.installationId,
        externalRepoId: resolved.externalRepoId
      });
      if (!repository) return;

      let shouldClose = await p.onSelect(repository);
      if (shouldClose !== false) p.close();
      return;
    }

    let shouldClose = await p.onSelectPublicUrl(publicRepository.url);
    if (shouldClose !== false) p.close();
  };

  let publicRepositoryOption = publicRepository ? (
    <PublicRepositoryItem>
      <RepoIcon>
        <RiExternalLinkLine size={18} />
      </RepoIcon>
      <div style={{ minWidth: 0 }}>
        <RepoTitle>{publicRepository.identifier}</RepoTitle>
        <RepoMeta>Public {formatScmProvider(publicRepository.provider)} repository</RepoMeta>
      </div>
      <Button
        size="2"
        onClick={selectPublicRepository}
        loading={resolveRepo.isLoading || createRepo.isLoading}
      >
        Import
      </Button>
    </PublicRepositoryItem>
  ) : null;

  return renderWithLoader({ installations })(({ installations }) => (
    <Panel.Content>
      <PickerContent>
        {!installations.data.items.length && !p.allowPublicUrl ? (
          <ConnectState>
            <ConnectIcon>
              <RiGitRepositoryLine size={22} />
            </ConnectIcon>
            <Text size="3" weight="strong">
              Connect source control
            </Text>
            <Spacer size={4} />
            <Text size="2" color="gray600">
              Connect GitHub, GitLab, or Bitbucket to select or create a repository.
            </Text>
            <Spacer size={14} />
            <Button
              size="2"
              onClick={connect}
              loading={createInstallation.isLoading}
              iconLeft={<RiAddLine />}
            >
              Add connection
            </Button>
            <Spacer size={8} />
            <Menu
              lightMode
              items={[
                {
                  id: 'github_enterprise',
                  label: 'GitHub Enterprise'
                },
                {
                  id: 'gitlab_selfhosted',
                  label: 'GitLab Self-Managed'
                },
                {
                  id: 'bitbucket_data_center',
                  label: 'Bitbucket Data Center'
                }
              ]}
              onItemClick={id =>
                setupProvider(
                  id as 'github_enterprise' | 'gitlab_selfhosted' | 'bitbucket_data_center'
                )
              }
            >
              <Button
                size="2"
                variant="outline"
                loading={createProvider.isLoading}
                iconLeft={<RiSettings3Line />}
              >
                Set up custom provider
              </Button>
            </Menu>
            <createInstallation.RenderError />
            <createProvider.RenderError />
          </ConnectState>
        ) : view == 'create' ? (
          <>
            <BackButton type="button" onClick={() => setView('repositories')}>
              <RiArrowLeftLine size={15} /> Back to repositories
            </BackButton>

            <CreateCard>
              <Text size="3" weight="strong">
                Create a repository in {selectedAccount?.name}
              </Text>
              <Spacer size={4} />
              <Text size="2" color="gray600">
                The repository will be created through the selected connection and selected
                immediately.
              </Text>
              <Spacer size={16} />
              <Input
                label="Repository name"
                placeholder="e.g. customer-support-tools"
                value={createName}
                onChange={event => setCreateName(event.target.value)}
                autoFocus
              />
              <Spacer size={12} />
              <Select
                label="Visibility"
                items={[
                  { id: 'private', label: 'Private' },
                  { id: 'public', label: 'Public' }
                ]}
                value={createVisibility}
                onChange={value => setCreateVisibility(value as 'private' | 'public')}
              />
              <Spacer size={16} />
              <Flex justify="end">
                <Button
                  size="2"
                  onClick={createRepository}
                  disabled={!selectedAccount || !createName.trim()}
                  loading={createRepo.isLoading}
                >
                  Create and select repository
                </Button>
              </Flex>
              <createRepo.RenderError />
            </CreateCard>
          </>
        ) : (
          <>
            {installations.data.items[0] && (
              <InstallationAccountAutoSelect
                instanceId={p.instanceId}
                installation={installations.data.items[0]}
                selected={selectedAccount}
                onSelect={setSelectedAccount}
              />
            )}

            {!!installations.data.items.length && (
              <>
                <SectionLabel>Repository account</SectionLabel>
                <Popover.Root
                  operationKey={accountMenuKey}
                  align="start"
                  sideOffset={6}
                  trigger={
                    <AccountTrigger type="button">
                      <AccountAvatar
                        name={selectedAccount?.name ?? 'Source control account'}
                        imageUrl={selectedAccount?.imageUrl}
                        installationName={selectedAccount?.installationName}
                        installationImageUrl={selectedAccount?.installationImageUrl}
                        provider={selectedAccount?.provider ?? 'github'}
                        showInstallation
                      />

                      <div style={{ minWidth: 0 }}>
                        <AccountName>
                          {selectedAccount?.name ?? 'Select an account'}
                        </AccountName>
                        <AccountMeta>
                          {selectedAccount ? (
                            <>
                              <span>{formatScmProvider(selectedAccount.provider)}</span>
                              <span>·</span>
                              <span>{selectedAccount.installationName}</span>
                            </>
                          ) : (
                            'Loading available accounts…'
                          )}
                        </AccountMeta>
                      </div>

                      <RiArrowDownSLine size={18} />
                    </AccountTrigger>
                  }
                >
                  <Popover.Content>
                    <AccountMenu>
                      <AccountMenuTitle>Available accounts</AccountMenuTitle>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {installations.data.items.map((installation, index) => (
                          <InstallationAccounts
                            key={installation.id}
                            instanceId={p.instanceId}
                            installation={installation}
                            selected={selectedAccount}
                            autoSelect={index == 0}
                            onSelect={account => {
                              setSelectedAccount(account);
                              setSearch('');
                              setPreviewCursor(undefined);
                              setLoadedRepos([]);
                              setAccountMenuKey(
                                `${account.installationId}:${account.externalAccountId}`
                              );
                            }}
                          />
                        ))}
                      </div>

                      <AccountMenuActions>
                        <Button
                          size="2"
                          variant="outline"
                          onClick={connect}
                          loading={createInstallation.isLoading}
                          iconLeft={<RiAddLine />}
                        >
                          Add connection
                        </Button>
                        <Menu
                          matchTriggerWidth
                          lightMode
                          items={[
                            {
                              id: 'github_enterprise',
                              label: 'GitHub Enterprise'
                            },
                            {
                              id: 'gitlab_selfhosted',
                              label: 'GitLab Self-Managed'
                            },
                            {
                              id: 'bitbucket_data_center',
                              label: 'Bitbucket Data Center'
                            }
                          ]}
                          onItemClick={id =>
                            setupProvider(
                              id as
                                | 'github_enterprise'
                                | 'gitlab_selfhosted'
                                | 'bitbucket_data_center'
                            )
                          }
                        >
                          <Button
                            size="2"
                            variant="outline"
                            loading={createProvider.isLoading}
                            iconLeft={<RiSettings3Line />}
                          >
                            Set up provider
                          </Button>
                        </Menu>
                      </AccountMenuActions>
                    </AccountMenu>
                  </Popover.Content>
                </Popover.Root>
              </>
            )}

            <SearchRow>
              <Input
                label="Search repositories"
                hideLabel
                placeholder={
                  p.allowPublicUrl
                    ? 'Search repositories or enter a public repository URL…'
                    : 'Search repositories…'
                }
                value={search}
                onChange={event => setSearch(event.target.value)}
                onKeyDown={event => {
                  if (event.key == 'Enter' && publicRepository) {
                    event.preventDefault();
                    selectPublicRepository();
                  }
                }}
              />
              {p.allowCreate && (
                <Button
                  variant="outline"
                  iconLeft={<RiAddLine />}
                  onClick={() => setView('create')}
                  disabled={!selectedAccount}
                >
                  Create repository
                </Button>
              )}
            </SearchRow>

            {publicRepositoryOption}

            {!installations.data.items.length && !publicRepository && (
              <>
                <Spacer height={20} />

                <EmptyState>
                  <Text size="2" weight="strong">
                    Select a public repository or add a connection
                  </Text>
                  <Spacer size={4} />
                  <Text size="2" color="gray600">
                    Paste a public GitHub, GitLab, or Bitbucket repository URL above.
                  </Text>
                  <Spacer size={12} />
                  <Button
                    size="2"
                    variant="outline"
                    onClick={connect}
                    loading={createInstallation.isLoading}
                    iconLeft={<RiAddLine />}
                  >
                    Add connection
                  </Button>
                </EmptyState>
              </>
            )}

            {selectedAccount ? (
              repos.isLoading && loadedRepos.length == 0 ? (
                <>
                  <Spacer height={20} />
                  <Text size="2" color="gray600">
                    Loading repositories…
                  </Text>
                </>
              ) : (
                <>
                  {(!publicRepository || filteredRepos.length > 0) && (
                    <>
                      <ResultMeta>
                        <Text size="1" color="gray600">
                          {filteredRepos.length}{' '}
                          {filteredRepos.length == 1 ? 'repository' : 'repositories'}
                        </Text>
                        <Text size="1" color="gray600">
                          {formatScmProvider(selectedAccount.provider)}
                        </Text>
                      </ResultMeta>

                      <RepoList>
                        {filteredRepos.map(repository => {
                          let selected = repository.externalId == p.selectedExternalRepoId;
                          return (
                            <RepoItem
                              key={repository.externalId}
                              type="button"
                              $selected={selected}
                              disabled={createRepo.isLoading}
                              onClick={() => selectRepository(repository.externalId)}
                            >
                              <RepoIcon>
                                <RiGitRepositoryLine size={18} />
                              </RepoIcon>
                              <div style={{ minWidth: 0 }}>
                                <RepoTitle>{repository.identifier}</RepoTitle>
                                <RepoMeta>
                                  {formatScmProvider(repository.provider)} · {repository.name}
                                </RepoMeta>
                              </div>
                              <Button
                                as="div"
                                size="2"
                                variant={selected ? 'solid' : 'outline'}
                                success={selected}
                                loading={
                                  !!(
                                    createRepo.isLoading &&
                                    createRepo.input &&
                                    'externalRepoId' in createRepo.input &&
                                    createRepo.input.externalRepoId == repository.externalId
                                  )
                                }
                              >
                                {selected ? 'Selected' : 'Select'}
                              </Button>
                            </RepoItem>
                          );
                        })}

                        {!filteredRepos.length && (
                          <EmptyState>
                            <Text size="2" weight="strong">
                              No repositories found
                            </Text>
                            <Spacer size={4} />
                            <Text size="2" color="gray600">
                              {search
                                ? 'Try another search or switch to a different account.'
                                : 'This account has no available repositories.'}
                            </Text>
                          </EmptyState>
                        )}
                      </RepoList>
                    </>
                  )}
                </>
              )
            ) : null}

            <createInstallation.RenderError />
            <createProvider.RenderError />
            <createRepo.RenderError />
            <resolveRepo.RenderError />
            {p.selectionError}

            <Footer>
              <Text size="1" color="gray600">
                {selectedAccount ? (
                  <>
                    Selecting from <strong>{selectedAccount.name}</strong> on{' '}
                    {formatScmProvider(selectedAccount.provider)}
                  </>
                ) : (
                  'Select an account to browse repositories'
                )}
              </Text>
              {p.onManageSourceControl && (
                <Button
                  size="1"
                  variant="ghost"
                  onClick={p.onManageSourceControl}
                  iconLeft={<RiSettings3Line />}
                >
                  Manage source control
                </Button>
              )}
            </Footer>
          </>
        )}
      </PickerContent>
    </Panel.Content>
  ));
};

export let showScmRepositoryPicker = (
  p: Omit<ScmRepositoryPickerProps, 'close'> & {
    title?: string;
    description?: string;
  }
) =>
  showModal(({ dialogProps, close }) => (
    <Panel.Wrapper {...dialogProps} width={680}>
      <Panel.Header>
        <Panel.Title>{p.title ?? 'Select a repository'}</Panel.Title>
        <Panel.Description>
          {p.description ?? 'Choose the repository Metorial should use as the source.'}
        </Panel.Description>
      </Panel.Header>
      <ScmRepositoryPicker {...p} close={close} />
    </Panel.Wrapper>
  ));
