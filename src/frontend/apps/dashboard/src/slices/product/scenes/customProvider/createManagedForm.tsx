import {
  type DashboardInstanceScmReposCreateOutput,
  CustomProvidersGetOutput
} from '@metorial/dashboard-sdk';
import { renderWithLoader, useForm } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import {
  listCustomProviderVersions,
  useCreateCustomProvider,
  useCreateScmRepo,
  useCurrentInstance,
  useScmAccounts,
  useScmInstallations
} from '@metorial/state';
import {
  Avatar,
  Button,
  CenteredSpinner,
  Input,
  Or,
  Select,
  Spacer,
  toast
} from '@metorial/ui';
import {
  RiBracesLine,
  RiCodeBoxLine,
  RiGlobalLine,
  RiKey2Line,
  RiSettings3Line
} from '@remixicon/react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Stepper } from '../../../../components/stepper';
import {
  getManagedServerTemplateFiles,
  managedServerTemplates as managedServerTemplateCatalog,
  type ManagedServerTemplate
} from './config';
import {
  Actions,
  Form,
  Templates,
  TemplatesItem,
  TemplateIconFrame,
  TemplateWrapper
} from './createFormShared';
import { SelectRepo } from './selectRepo';
import { waitForCustomProviderVersionId } from './utils';

let TemplateIcon = ({ template }: { template: ManagedServerTemplate }) => {
  if (template.imageUrl) {
    return <Avatar entity={template} size={24} imageFit="contain" />;
  }

  let icon = (() => {
    if (template.icon === 'http') return <RiGlobalLine size={20} />;
    if (template.icon === 'config') return <RiSettings3Line size={20} />;
    if (template.icon === 'oauth') return <RiKey2Line size={20} />;
    if (template.icon === 'tools') return <RiBracesLine size={20} />;
    return <RiCodeBoxLine size={20} />;
  })();

  return <TemplateIconFrame>{icon}</TemplateIconFrame>;
};

export let CustomProviderManagedCreateForm = (p: {
  templateId?: string;
  close?: () => any;
  onCreate?: (out: CustomProvidersGetOutput) => any;
}) => {
  let instance = useCurrentInstance();
  let createCustomProvider = useCreateCustomProvider();
  let managedServerTemplates = {
    data: { items: managedServerTemplateCatalog },
    isLoading: false,
    error: null
  };

  let [selectedRepo, setSelectedRepo] = useState<
    DashboardInstanceScmReposCreateOutput | undefined
  >(undefined);
  let selectedRepoId = selectedRepo?.id;
  let selectedExternalRepoId = selectedRepo?.provider.id;

  let navigate = useNavigate();
  let [templateId, setTemplateId] = useState<string | undefined>(undefined);
  let [currentStep, setCurrentStep] = useState(0);

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

      let runtime = { identifier: 'nodejs' as const, version: '22.x' as const };
      let repoPath = values.path?.trim() || undefined;
      let template =
        managedServerTemplates.data.items.find(t => t.id === templateId || t.slug === templateId) ??
        managedServerTemplates.data.items[0]!;

      let [customProviderRes] = await createCustomProvider.mutate({
        instanceId: instance.data.id,
        name: values.name,
        description: values.description,
        from: selectedRepo
          ? {
              type: 'function',
              env: {},
              runtime,
              repository: {
                repositoryId: selectedRepo.id,
                branch: selectedRepo.defaultBranch || 'main',
                path: repoPath
              }
            }
          : {
              type: 'function',
              files: getManagedServerTemplateFiles(template),
              env: {},
              runtime
            }
      });

      if (customProviderRes) {
        let firstVersionId = await waitForCustomProviderVersionId(async () => {
          let [versionsRes] = await listCustomProviderVersions({
            limit: 1,
            instanceId: instance.data.id,
            customProviderId: customProviderRes.id
          });

          return versionsRes?.items[0]?.id;
        });

        toast.success('Custom MCP server created successfully');

        if (p.onCreate) {
          p.onCreate(customProviderRes);
        } else {
          navigate(
            Paths.instance.customProvider(
              instance.data.organization,
              instance.data.project,
              instance.data,
              customProviderRes.id,
              ...(firstVersionId ? ['versions', { version_id: firstVersionId }] : [])
            ),
            {
              state: {
                category: 'custom'
              }
            }
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
      disabled={createCustomProvider.isLoading}
      size="2"
    >
      Close
    </Button>
  );

  let installations = useScmInstallations(instance.data?.id);
  let createRepo = useCreateScmRepo();
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

  let setTemplate = (templateId: string, opts?: { advance?: boolean }) => {
    let template = managedServerTemplates.data?.items.find(
      t => t.id === templateId || t.slug === templateId
    );
    if (!template) return;

    form.resetForm();
    form.setFieldValue('name', template.name);
    form.setFieldValue('description', template.description);
    setCreateRepoName(template.slug);
    setTemplateId(template.id);
    setSelectedRepo(undefined);

    if (opts?.advance) setCurrentStep(1);
  };

  let settingTemplateRef = useRef(false);
  useEffect(() => {
    if (!p.templateId || !managedServerTemplates.data || installations.isLoading) return;

    if (settingTemplateRef.current) return;
    settingTemplateRef.current = true;

    setTemplate(p.templateId, { advance: true });
  }, [p.templateId, managedServerTemplates.data, installations.isLoading]);

  if (p.templateId && !templateId) return <CenteredSpinner />;

  let handleSetupSubmit = () => {
    if (!selectedRepo && !templateId) return;
    setCurrentStep(1);
  };

  return (
    <Form>
      <Stepper
        currentStep={currentStep}
        setCurrentStep={setCurrentStep}
        steps={[
          {
            title: 'Setup',
            subtitle: 'Choose a source',
            render: () => {
              return (
                <form
                  onSubmit={e => {
                    e.preventDefault();
                    handleSetupSubmit();
                  }}
                >
                  <TemplateWrapper>
                    <SelectRepo
                      selectedExternalRepoId={selectedExternalRepoId}
                      onSelect={repo => {
                        setSelectedRepo(repo);
                        form.resetForm();
                        form.setFieldValue('name', repo.provider.name);
                        setTemplateId(undefined);
                      }}
                    />

                    {renderWithLoader({ installations })(({ installations }) =>
                      installations.data.items.length
                        ? renderWithLoader({ accounts })(({ accounts }) => (
                            <>
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
                                  onChange={v => setSelectedInstallationId(v)}
                                />
                              )}

                              {accounts.data.accounts.filter(Boolean).length > 0 && (
                                <Select
                                  label="GitHub Account"
                                  items={accounts.data.accounts.filter(Boolean).map(i => ({
                                    label: i.name,
                                    id: i.externalId
                                  }))}
                                  value={selectedAccountId}
                                  onChange={v => setSelectedAccountId(v)}
                                />
                              )}

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

                              <Button
                                type="button"
                                size="2"
                                disabled={
                                  !selectedInstallationId ||
                                  !selectedAccountId ||
                                  !createRepoName.trim()
                                }
                                onClick={async () => {
                                  let [res] = await createRepo.mutate({
                                    instanceId: instance.data?.id!,
                                    installationId: selectedInstallationId!,
                                    externalAccountId: selectedAccountId!,
                                    name: createRepoName,
                                    isPrivate: createRepoIsPrivate
                                  });

                                  if (res) {
                                    setSelectedRepo(res);
                                    form.resetForm();
                                    form.setFieldValue('name', createRepoName);
                                    setTemplateId(undefined);
                                  }
                                }}
                                loading={createRepo.isLoading}
                              >
                                Create Repository
                              </Button>
                            </>
                          ))
                        : null
                    )}

                    <Spacer size={10} />

                    <Or text="OR" />

                    <Spacer size={10} />

                    <Templates>
                      {managedServerTemplates.data.items.map(template => (
                        <TemplatesItem
                          key={template.id}
                          type="button"
                        onClick={() => setTemplate(template.id, { advance: true })}
                        >
                          <TemplateIcon template={template} />
                          <span>{template.name}</span>
                        </TemplatesItem>
                      ))}
                    </Templates>

                    <Actions>
                      {close}

                      <Button type="submit" size="2" disabled={!selectedRepo && !templateId}>
                        Continue
                      </Button>
                    </Actions>
                  </TemplateWrapper>
                </form>
              );
            }
          },

          {
            title: 'Finish',
            subtitle: 'Review and create the custom MCP server',
            render: () => {
              return (
                <form onSubmit={form.handleSubmit}>
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
                      loading={createCustomProvider.isLoading}
                      success={createCustomProvider.isSuccess}
                      disabled={createRepo.isLoading || createCustomProvider.isLoading}
                      type="submit"
                      size="2"
                    >
                      Create Custom MCP Server
                    </Button>
                  </Actions>
                </form>
              );
            }
          }
        ]}
      />

      {createCustomProvider.error && <createCustomProvider.RenderError />}
    </Form>
  );
};
