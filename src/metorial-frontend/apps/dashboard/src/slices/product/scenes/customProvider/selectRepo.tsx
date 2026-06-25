import { DashboardInstanceScmReposCreateOutput } from '@metorial/dashboard-sdk';
import { renderWithLoader } from '@metorial/data-hooks';
import {
  useCreateScmInstallation,
  useCreateScmRepo,
  useCurrentInstance,
  useScmAccounts,
  useScmInstallations,
  useScmRepos
} from '@metorial/state';
import { Button, Input, Select, theme, toast } from '@metorial/ui';
import { RiGithubFill } from '@remixicon/react';
import { useEffect, useState } from 'react';
import styled from 'styled-components';
import { openWindow } from '../../../../lib/openWindows';

let SelectorWrapper = styled.div`
  display: flex;
  flex-direction: column;
  gap: 5px;
`;

let SelectorHeader = styled.header`
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

let SelectorTitle = styled.h3`
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: ${theme.colors.gray900};
`;

let ConnectCard = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border: 1px solid ${theme.colors.gray300};
  border-radius: 8px;
  background: ${theme.colors.gray100};
`;

let ConnectIcon = styled.div`
  width: 34px;
  height: 34px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  color: ${theme.colors.gray900};
  background: ${theme.colors.background};
  border: 1px solid ${theme.colors.gray300};
`;

let ConnectContent = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  width: 100%;
`;

let ConnectText = styled.div`
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
`;

let ConnectTitle = styled.h3`
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: ${theme.colors.gray900};
`;

let ConnectDescription = styled.p`
  margin: 0;
  font-size: 12px;
  font-weight: 500;
  color: ${theme.colors.gray700};
`;

let RepoControls = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
  gap: 10px;
`;

let RepoBox = styled.div`
  max-height: 340px;
  border: ${theme.colors.gray300} 1px solid;
  display: flex;
  flex-direction: column;
  border-radius: 10px;
  overflow: auto;
  position: relative;
  background: ${theme.colors.gray100};
`;

let RepoSearch = styled.div`
  position: sticky;
  top: 0;
  background: ${theme.colors.gray100};
  padding: 10px;
  border-bottom: ${theme.colors.gray300} 1px solid;
  z-index: 3;
`;

let RepoList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 8px;
`;

let RepoItem = styled.button`
  padding: 12px 14px;
  background: ${theme.colors.background};
  cursor: pointer;
  text-align: left;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  border: 1px solid ${theme.colors.gray300};
  border-radius: 8px;
  transition:
    border-color 0.18s ease,
    background 0.18s ease;

  h3 {
    font-size: 14px;
    font-weight: 600;
    margin: 0;
    color: ${theme.colors.gray900};
  }

  p {
    font-size: 12px;
    color: ${theme.colors.gray700};
    font-weight: 500;
    margin: 0;
  }

  main {
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 0;
  }

  main > div {
    display: flex;
    flex-direction: column;
    gap: 3px;
    min-width: 0;
  }

  &:hover,
  &:focus-visible {
    border-color: ${theme.colors.gray500};
    background: ${theme.colors.gray100};
    outline: none;
  }

  &[data-selected='true'] {
    border-color: ${theme.colors.gray900};
    background: ${theme.colors.gray100};
  }
`;

let EmptyRepos = styled.div`
  padding: 18px;
  text-align: center;
  color: ${theme.colors.gray700};
  font-size: 13px;
  font-weight: 500;
`;

let formatRepoProvider = (provider: 'github' | 'gitlab' | undefined) => {
  if (provider === 'github') return 'GitHub';
  if (provider === 'gitlab') return 'GitLab';
  return '';
};

export let ConnectGitHubButton = (p: { onConnected: () => void }) => {
  let instance = useCurrentInstance();
  let createInstallation = useCreateScmInstallation();

  return (
    <Button
      onClick={async () => {
        let [res] = await createInstallation.mutate({
          instanceId: instance.data?.id!,
          redirectUrl: window.location.href
        });

        let toastShownRef = { current: false };

        if (res) {
          openWindow(res?.url!).onMessage(msg => {
            if (msg.data.type === 'scm_complete') {
              p.onConnected();

              if (!toastShownRef.current) {
                toast.success('GitHub connected successfully');
                toastShownRef.current = true;
              }
            }
          });
        }
      }}
      size="2"
      type="button"
    >
      Connect GitHub
    </Button>
  );
};

export let SelectRepo = (props: {
  onSelect: (repo: DashboardInstanceScmReposCreateOutput) => void;
  selectedExternalRepoId?: string;
}) => {
  let instance = useCurrentInstance();

  let installations = useScmInstallations(instance.data?.id);
  let installationsOuter = installations;
  let createRepo = useCreateScmRepo();
  let [repoSearch, setRepoSearch] = useState<string>('');
  let [selectedInstallationId, setSelectedInstallationId] = useState<string | undefined>(
    undefined
  );
  useEffect(() => {
    if (installations.data?.items.length) {
      setSelectedInstallationId(installations.data.items[0].id);
    }
  }, [installations.data?.items]);
  let accounts = useScmAccounts(
    instance.data?.id,
    selectedInstallationId ? { installationId: selectedInstallationId } : undefined
  );
  let accountItems = (accounts.data?.accounts ?? []).filter(Boolean);
  let [selectedAccountId, setSelectedAccountId] = useState<string | undefined>(undefined);
  useEffect(() => {
    if (accountItems.length) {
      setSelectedAccountId(accountItems[0].externalId);
    }
  }, [accountItems]);
  let repos = useScmRepos(
    instance.data?.id,
    selectedInstallationId && selectedAccountId
      ? {
          installationId: selectedInstallationId,
          externalAccountId: selectedAccountId
        }
      : undefined
  );

  return renderWithLoader({ installations })(({ installations }) => (
    <SelectorWrapper>
      {!installations.data.items.length ? (
        <ConnectCard>
          <ConnectIcon>
            <RiGithubFill size={20} />
          </ConnectIcon>

          <ConnectContent>
            <ConnectText>
              <ConnectTitle>Import from GitHub</ConnectTitle>
              <ConnectDescription>
                Connect GitHub to import or create a repository.
              </ConnectDescription>
            </ConnectText>

            <div>
              <ConnectGitHubButton
                onConnected={() => {
                  installationsOuter.refetch();
                }}
              />
            </div>
          </ConnectContent>
        </ConnectCard>
      ) : (
        renderWithLoader({ accounts, repos })(({ accounts, repos }) => (
          <>
            <SelectorHeader>
              <SelectorTitle>Import from GitHub</SelectorTitle>
            </SelectorHeader>

            {(installations.data.items.length > 1 || accountItems.length > 0) && (
              <RepoControls>
                {installations.data.items.length > 1 && (
                  <div>
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
                      onChange={v => setSelectedInstallationId(v)}
                    />
                  </div>
                )}

                {accountItems.length > 0 && (
                  <div>
                    <Select
                      label="GitHub Account"
                      items={accountItems.map(i => ({
                        label: i.name,
                        id: i.externalId
                      }))}
                      value={selectedAccountId}
                      onChange={v => setSelectedAccountId(v)}
                    />
                  </div>
                )}
              </RepoControls>
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
                  .filter(
                    r =>
                      repoSearch.trim() === '' ||
                      r.name.toLowerCase().includes(repoSearch.toLowerCase())
                  )
                  .map(r => {
                    let isSelected = props.selectedExternalRepoId == r.externalId;

                    return (
                      <RepoItem
                        key={r.externalId}
                        type="button"
                        data-selected={isSelected}
                        onClick={async () => {
                          let [res] = await createRepo.mutate({
                            instanceId: instance.data?.id!,
                            installationId: selectedInstallationId!,
                            externalRepoId: r.externalId
                          });

                          if (res) props.onSelect(res);
                        }}
                        disabled={createRepo.isLoading}
                      >
                        <main>
                          <div>
                            <h3>{r.identifier}</h3>
                            <p>{formatRepoProvider(r.provider)}</p>
                          </div>
                        </main>

                        <Button
                          size="2"
                          variant={isSelected ? 'solid' : 'soft'}
                          as="div"
                          loading={
                            !!(
                              createRepo.isLoading &&
                              createRepo.input &&
                              'externalRepoId' in createRepo.input &&
                              createRepo.input?.externalRepoId == r.externalId
                            )
                          }
                          success={isSelected}
                        >
                          Import
                        </Button>
                      </RepoItem>
                    );
                  })}

                {repos.data.repos.length === 0 && (
                  <EmptyRepos>No repositories found for this GitHub account.</EmptyRepos>
                )}
              </RepoList>
            </RepoBox>
          </>
        ))
      )}
    </SelectorWrapper>
  ));
};
