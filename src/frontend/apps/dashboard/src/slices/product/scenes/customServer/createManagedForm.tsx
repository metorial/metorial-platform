import { CustomServersGetOutput } from '@metorial/dashboard-sdk/src/gen/src/mt_2025_01_01_dashboard';
import { renderWithLoader, useForm } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import {
  useCreateCustomServer,
  useCreateScmInstallation,
  useCreateScmRepo,
  useCurrentInstance,
  useListServerVersions,
  useManagedServerTemplates,
  useScmAccounts,
  useScmInstallations,
  useScmRepos
} from '@metorial/state';
import { Button, Input, Or, Select, Spacer, theme, toast } from '@metorial/ui';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import { openWindow } from '../../../../lib/openWindows';
import { Stepper } from '../stepper';
import { defaultServerConfigManaged } from './config';

let PageWrapper = styled.div`
  display: flex;
  flex-direction: column;
  gap: 5px;
`;

let Actions = styled.div`
  display: flex;
  gap: 10px;
  justify-content: flex-end;
  margin-top: 10px;
`;

let Templates = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 10px;
`;

let TemplatesItem = styled.button`
  display: flex;
  align-items: center;
  padding: 10px;
  background: none;
  border: ${theme.colors.gray400} 1px solid;
  border-radius: 8px;
  text-align: left;
  gap: 10px;

  span {
    font-size: 14px;
    font-weight: 600;
    color: ${theme.colors.gray800};
  }
`;

let Form = styled.form`
  display: flex;
  flex-direction: column;
`;

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

export let CustomServerManagedCreateForm = (p: {
  close?: () => any;
  onCreate?: (out: CustomServersGetOutput) => any;
}) => {
  let instance = useCurrentInstance();
  let createCustomServer = useCreateCustomServer();
  let listServerVersions = useListServerVersions();
  let managedServerTemplates = useManagedServerTemplates({
    limit: 100
  });

  let installations = useScmInstallations(instance.data?.organization.id);
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
    instance.data?.organization.id,
    selectedInstallationId ? { installationId: selectedInstallationId } : undefined
  );
  let [selectedAccountId, setSelectedAccountId] = useState<string | undefined>(undefined);
  useEffect(() => {
    if (accounts.data?.items.length) {
      setSelectedAccountId(accounts.data.items[0].externalId);
    }
  }, [accounts.data?.items]);
  let repos = useScmRepos(
    instance.data?.organization.id,
    selectedInstallationId && selectedAccountId
      ? {
          installationId: selectedInstallationId,
          externalAccountId: selectedAccountId
        }
      : undefined
  );
  let [selectedRepoId, setSelectedRepoId] = useState<string | undefined>(undefined);

  let [currentStep, setCurrentStep] = useState(0);

  let navigate = useNavigate();
  let [templateId, setTemplateId] = useState<string | undefined>(undefined);

  let form = useForm({
    initialValues: {
      name: '',
      description: '',
      metadata: {},
      path: ''
    },
    schema: yup =>
      yup.object({
        name: yup.string().required('Name is required'),
        description: yup.string().optional(),
        metadata: yup.object().optional(),
        path: yup.string().optional()
      }),
    onSubmit: async values => {
      if (!instance.data) return;

      let plainTemplate = managedServerTemplates.data?.items.find(
        t => t.slug == 'plain-typescript'
      );

      let [customServerRes] = await createCustomServer.mutate({
        instanceId: instance.data.id,
        name: values.name,
        description: values.description,
        implementation: {
          type: 'managed',
          managedServer: {
            templateId: templateId ?? plainTemplate?.id,
            repository: selectedRepoId
              ? {
                  repositoryId: selectedRepoId,
                  path: values.path?.trim() || '/'
                }
              : undefined
          },
          config: defaultServerConfigManaged
        }
      });

      if (customServerRes) {
        let firstVersionId: string | undefined = undefined;

        for (let i = 0; i < 5; i++) {
          let [versionsRes] = await listServerVersions.mutate({
            limit: 1,
            instanceId: instance.data.id,
            customServerId: customServerRes.id
          });
          if (versionsRes && versionsRes.items.length > 0) {
            firstVersionId = versionsRes?.items[0]?.id;
            break;
          }
        }

        toast.success('Server created successfully');

        if (p.onCreate) {
          p.onCreate(customServerRes);
        } else {
          navigate(
            Paths.instance.customServer(
              instance.data.organization,
              instance.data.project,
              instance.data,
              customServerRes.id,
              ...(firstVersionId ? ['versions', { version_id: firstVersionId }] : [])
            )
          );
        }
      }
    }
  });

  let [createRepoName, setCreateRepoName] = useState('');
  let [createRepoIsPrivate, setCreateRepoIsPrivate] = useState(true);

  let close = p.close && (
    <Button
      type="button"
      variant="outline"
      onClick={p.close}
      disabled={createCustomServer.isLoading}
      size="2"
    >
      Close
    </Button>
  );

  return (
    <Form
      onSubmit={e => {
        if (currentStep < 1) {
          e.preventDefault();
          e.stopPropagation();
          setCurrentStep(currentStep + 1);
          return;
        }

        return form.handleSubmit(e);
      }}
    >
      <Stepper
        currentStep={currentStep}
        setCurrentStep={setCurrentStep}
        steps={[
          {
            title: 'Choose Template',
            subtitle: 'Choose a template for your MCP server',
            render: () => {
              return renderWithLoader({ managedServerTemplates, installations })(
                ({ managedServerTemplates, installations }) => (
                  <PageWrapper>
                    {!installations.data.items.length ? (
                      <Button
                        onClick={async () => {
                          let [res] = await createInstallation.mutate({
                            organizationId: instance.data?.organization.id!,
                            provider: 'github',
                            redirectUrl: window.location.href
                          });

                          let toastShownRef = { current: false };

                          if (res) {
                            openWindow(res?.authorizationUrl!).onMessage(msg => {
                              if (msg.data.type === 'scm_complete') {
                                installationsOuter.refetch();

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
                    ) : (
                      renderWithLoader({ accounts, repos })(({ accounts, repos }) => (
                        <div>
                          {installations.data.items.length > 1 && (
                            <>
                              <Select
                                label="GitHub Installation"
                                items={installations.data.items.map(i => ({
                                  label: i.user.name,
                                  id: i.id
                                }))}
                                value={selectedInstallationId}
                                onChange={v => setSelectedInstallationId(v)}
                              />
                              <Spacer size={10} />
                            </>
                          )}

                          {accounts.data.items.length > 0 && (
                            <>
                              <Select
                                label="GitHub Account"
                                items={accounts.data.items.map(i => ({
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
                              {repos.data.items
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
                                        organizationId: instance.data?.organization.id!,
                                        installationId: selectedInstallationId!,
                                        externalRepoId: r.externalId
                                      });

                                      if (res) {
                                        setSelectedRepoId(res.id);
                                        form.resetForm();
                                        form.setFieldValue('name', r.name);
                                        setTemplateId(undefined);
                                        setCurrentStep(2);
                                      }
                                    }}
                                    disabled={
                                      createRepo.isLoading || createCustomServer.isLoading
                                    }
                                  >
                                    <main>
                                      <h3>
                                        {r.account.name} &middot; {r.name}
                                      </h3>
                                      <p>
                                        Last pushed:{' '}
                                        {r.lastPushedAt
                                          ? new Date(r.lastPushedAt).toLocaleDateString(
                                              undefined,
                                              {
                                                year: 'numeric',
                                                month: 'short',
                                                day: 'numeric'
                                              }
                                            )
                                          : 'N/A'}
                                      </p>
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
                                    >
                                      Import
                                    </Button>
                                  </RepoItem>
                                ))}

                              {repos.data.items.length === 0 && (
                                <div>No repositories found</div>
                              )}
                            </RepoList>
                          </RepoBox>
                        </div>
                      ))
                    )}

                    <Spacer size={10} />

                    <Or />

                    <Spacer size={10} />

                    <Templates>
                      {managedServerTemplates.data.items.map(template => (
                        <TemplatesItem
                          key={template.id}
                          type="button"
                          onClick={() => {
                            form.resetForm();
                            form.setFieldValue('name', template.name);
                            setCreateRepoName(template.slug);
                            setTemplateId(template.id);
                            setCurrentStep(1);
                          }}
                        >
                          <span>{template.name}</span>
                        </TemplatesItem>
                      ))}
                    </Templates>

                    <Actions>
                      {close}

                      <Button
                        type="button"
                        size="2"
                        onClick={() => {
                          setTemplateId(undefined);
                          setCurrentStep(2);
                        }}
                      >
                        Continue without template
                      </Button>
                    </Actions>
                  </PageWrapper>
                )
              );
            }
          },

          {
            title: 'Connect Repository',
            subtitle: 'Connect a GitHub repository',
            render: () => {
              return (
                <>
                  {renderWithLoader({ accounts, installations })(
                    ({ accounts, installations }) => (
                      <>
                        {installations.data.items.length > 1 && (
                          <>
                            <Select
                              label="GitHub Installation"
                              items={installations.data.items.map(i => ({
                                label: i.user.name,
                                id: i.id
                              }))}
                              value={selectedInstallationId}
                              onChange={v => setSelectedInstallationId(v)}
                            />
                            <Spacer size={10} />
                          </>
                        )}

                        {accounts.data.items.length > 0 && (
                          <>
                            <Select
                              label="GitHub Account"
                              items={accounts.data.items.map(i => ({
                                label: i.name,
                                id: i.externalId
                              }))}
                              value={selectedAccountId}
                              onChange={v => setSelectedAccountId(v)}
                            />
                            <Spacer size={10} />
                          </>
                        )}

                        <Input
                          label="Repository Name"
                          placeholder="e.g. my-repo"
                          value={createRepoName}
                          onChange={e => setCreateRepoName(e.target.value)}
                        />

                        <Spacer size={10} />

                        <Select
                          label="Repository Visibility"
                          items={[
                            { label: 'Private', id: 'private' },
                            { label: 'Public', id: 'public' }
                          ]}
                          value={createRepoIsPrivate ? 'private' : 'public'}
                          onChange={v => setCreateRepoIsPrivate(v === 'private')}
                        />

                        <Spacer size={10} />

                        <Button
                          size="2"
                          disabled={
                            !selectedInstallationId ||
                            !selectedAccountId ||
                            !createRepoName.trim()
                          }
                          onClick={async () => {
                            let [res] = await createRepo.mutate({
                              organizationId: instance.data?.organization.id!,
                              installationId: selectedInstallationId!,
                              externalAccountId: selectedAccountId!,
                              name: createRepoName,
                              isPrivate: createRepoIsPrivate
                            });

                            if (res) {
                              setSelectedRepoId(res.id);
                              form.resetForm();
                              form.setFieldValue('name', createRepoName);
                              setCurrentStep(2);
                            }
                          }}
                          loading={createRepo.isLoading}
                        >
                          Continue
                        </Button>
                      </>
                    )
                  )}
                </>
              );
            }
          },

          {
            title: 'Finish',
            subtitle: 'Review and deploy',
            render: () => {
              return (
                <>
                  <Input label="Name" {...form.getFieldProps('name')} autoFocus />
                  <form.RenderError field="name" />

                  <Spacer size={15} />

                  <Input label="Description" {...form.getFieldProps('description')} />
                  <form.RenderError field="description" />

                  {selectedRepoId && !templateId && (
                    <>
                      <Spacer size={15} />

                      <Input
                        label="Path (optional)"
                        description="The path of the MCP server in the repository."
                        {...form.getFieldProps('path')}
                        placeholder="e.g. ./my-server"
                      />
                      <form.RenderError field="path" />
                    </>
                  )}

                  <Actions>
                    {close}

                    <Button
                      loading={createCustomServer.isLoading}
                      success={createCustomServer.isSuccess}
                      disabled={createRepo.isLoading || createCustomServer.isLoading}
                      type="submit"
                      size="2"
                    >
                      Create
                    </Button>
                  </Actions>
                </>
              );
            }
          }
        ]}
      />

      {createCustomServer.error && <createCustomServer.RenderError />}
    </Form>
  );
};
