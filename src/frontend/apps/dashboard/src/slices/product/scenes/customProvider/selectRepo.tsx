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
import { Button, Input, Select, Spacer, theme, toast } from '@metorial/ui';
import { useEffect, useState } from 'react';
import styled from 'styled-components';
import { openWindow } from '../../../../lib/openWindows';

let RepoBox = styled.div`
  max-height: 300px;
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
  gap: 5px;
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
  }

  &:not(:last-child) {
    border-bottom: ${theme.colors.gray400} 1px solid;
  }
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
          provider: 'github',
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
      size="3"
      fullWidth
      type="button"
    >
      Connect GitHub
    </Button>
  );
};

export let SelectRepo = (props: {
  onSelect: (repo: DashboardInstanceScmReposCreateOutput) => void;
  selectedRepoId?: string;
}) => {
  let instance = useCurrentInstance();

  let installations = useScmInstallations(instance.data?.id);
  let installationsOuter = installations;
  let createInstallation = useCreateScmInstallation();
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
    <>
      {!installations.data.items.length ? (
        <ConnectGitHubButton
          onConnected={() => {
            installationsOuter.refetch();
          }}
        />
      ) : (
        renderWithLoader({ accounts, repos })(({ accounts, repos }) => (
          <div>
            {installations.data.items.length > 1 && (
              <>
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
                <Spacer size={10} />
              </>
            )}

            {accountItems.length > 0 && (
              <>
                <Select
                  label="GitHub Account"
                  items={accountItems.map(i => ({
                    label: i.name,
                    id: i.externalId
                  }))}
                  value={selectedAccountId}
                  onChange={v => setSelectedAccountId(v)}
                />
                <Spacer size={10} />
              </>
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
                  .map(r => (
                    <RepoItem
                      key={r.externalId}
                      type="button"
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
                        <h3>
                          {r.identifier}
                        </h3>
                        <p>{formatRepoProvider(r.provider)}</p>
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
                            createRepo.input?.externalRepoId == r.externalId
                          )
                        }
                        success={props.selectedRepoId == r.externalId}
                      >
                        Import
                      </Button>
                    </RepoItem>
                  ))}

                {repos.data.repos.length === 0 && <div>No repositories found</div>}
              </RepoList>
            </RepoBox>
          </div>
        ))
      )}
    </>
  ));
};
