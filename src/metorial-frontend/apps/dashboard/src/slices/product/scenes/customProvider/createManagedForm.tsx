import {
  CustomProvidersGetOutput,
  type DashboardInstanceScmReposCreateOutput
} from '@metorial/dashboard-sdk';
import { useForm } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import { useGetPathWithPrefix } from '@metorial/microfrontend';
import { formatScmProvider, showScmRepositoryPicker } from '@metorial/scene-scm';
import {
  listCustomProviderVersions,
  useCreateCustomProvider,
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject
} from '@metorial/state';
import {
  Avatar,
  Badge,
  Button,
  CenteredSpinner,
  Input,
  Or,
  Spacer,
  Text,
  theme,
  toast
} from '@metorial/ui';
import {
  RiBracesLine,
  RiCodeBoxLine,
  RiGitRepositoryLine,
  RiGlobalLine,
  RiKey2Line,
  RiSettings3Line
} from '@remixicon/react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import { Stepper } from '../../../../components/stepper';
import {
  getManagedServerTemplateFiles,
  managedServerTemplates as managedServerTemplateCatalog,
  type ManagedServerTemplate
} from './config';
import {
  Actions,
  Form,
  TemplateIconFrame,
  Templates,
  TemplatesItem,
  TemplateWrapper
} from './createFormShared';
import { waitForCustomProviderVersionId } from './utils';

let RepositorySourceCard = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 14px;
  border: 1px solid ${theme.colors.gray300};
  border-radius: 10px;
  background: ${theme.colors.gray100};
`;

let RepositorySourceDetails = styled.div`
  display: flex;
  align-items: center;
  gap: 11px;
  min-width: 0;
`;

let RepositorySourceIcon = styled.div`
  width: 36px;
  height: 36px;
  display: grid;
  place-items: center;
  flex: none;
  border-radius: 8px;
  background: ${theme.colors.gray200};
  color: ${theme.colors.gray700};
`;

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
  let organization = useCurrentOrganization();
  let project = useCurrentProject();
  let getPath = useGetPathWithPrefix();
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
        managedServerTemplates.data.items.find(
          t => t.id === templateId || t.slug === templateId
        ) ?? managedServerTemplates.data.items[0]!;

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

  let setTemplate = (templateId: string, opts?: { advance?: boolean }) => {
    let template = managedServerTemplates.data?.items.find(
      t => t.id === templateId || t.slug === templateId
    );
    if (!template) return;

    form.resetForm();
    form.setFieldValue('name', template.name);
    form.setFieldValue('description', template.description);
    setTemplateId(template.id);
    setSelectedRepo(undefined);

    if (opts?.advance) setCurrentStep(1);
  };

  let settingTemplateRef = useRef(false);
  useEffect(() => {
    if (!p.templateId || !managedServerTemplates.data) return;

    if (settingTemplateRef.current) return;
    settingTemplateRef.current = true;

    setTemplate(p.templateId, { advance: true });
  }, [p.templateId, managedServerTemplates.data]);

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
                    <RepositorySourceCard>
                      <RepositorySourceDetails>
                        <RepositorySourceIcon>
                          <RiGitRepositoryLine size={18} />
                        </RepositorySourceIcon>
                        <div style={{ minWidth: 0 }}>
                          <Text size="2" weight="strong">
                            {selectedRepo
                              ? `${selectedRepo.provider.owner}/${selectedRepo.provider.name}`
                              : 'Import from a Git repository'}
                          </Text>
                          <Text size="1" color="gray600">
                            {selectedRepo
                              ? selectedRepo.url
                              : 'Choose an existing repository or create a new one.'}
                          </Text>
                          {selectedRepo && (
                            <>
                              <Spacer size={4} />
                              <Badge color="gray" size="1">
                                {formatScmProvider(selectedRepo.provider.type)}
                              </Badge>
                            </>
                          )}
                        </div>
                      </RepositorySourceDetails>

                      <Button
                        type="button"
                        size="2"
                        variant={selectedRepo ? 'outline' : 'solid'}
                        onClick={() => {
                          if (!instance.data) return;
                          showScmRepositoryPicker({
                            instanceId: instance.data.id,
                            selectedExternalRepoId: selectedRepo?.provider.id,
                            allowCreate: true,
                            onManageSourceControl: () => {
                              if (!organization.data || !project.data) return;
                              window.location.href = `/o/${organization.data.slug}/project/${project.data.slug}/scm`;
                            },
                            onSelect: repo => {
                              setSelectedRepo(repo);
                              form.resetForm();
                              form.setFieldValue('name', repo.provider.name);
                              setTemplateId(undefined);
                            }
                          });
                        }}
                      >
                        {selectedRepo ? 'Change' : 'Select repository'}
                      </Button>
                    </RepositorySourceCard>

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
                      disabled={createCustomProvider.isLoading}
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
