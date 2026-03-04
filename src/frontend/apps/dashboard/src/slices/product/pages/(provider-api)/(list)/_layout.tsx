import { useForm } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import { ContentLayout, PageHeader } from '@metorial/layout';
import {
  useCreateProviderAuthCredentials,
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useProvider,
  useProviderAuthMethods,
  useProviderDeployment,
  useProviderDeployments
} from '@metorial/state';
import {
  Badge,
  Button,
  CenteredSpinner,
  Copy,
  Dialog,
  Input,
  LinkTabs,
  RenderDate,
  showModal,
  Spacer,
  Text,
  theme
} from '@metorial/ui';
import { RiAddLine } from '@remixicon/react';
import { useMemo, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import { showProviderConfigVaultFormModal } from '../../../scenes/providerConfigVaults/modal';
import { showProviderConfigFormModal } from '../../../scenes/providerConfigs/modal';
import { ProviderDeploymentsList } from '../../../scenes/providerDeployments/list';
import { showProviderDeploymentFormModal } from '../../../scenes/providerDeployments/modal';
import { ProviderSetupSessionEmbed } from '../../../scenes/providerDeployments/setupSessionEmbed';
import { showProviderSetupSessionModal } from '../../../scenes/providerDeployments/setupSessionModal';
import { ProvidersWithDeploymentsSearch } from '../../../scenes/providers/search';
import { showSessionTemplateFormModal } from '../../../scenes/sessionTemplates/modal';
import { Stepper } from '../../../scenes/stepper';

export let ProvidersHubLayout = () => {
  return (
    <ContentLayout>
      <PageHeader
        title="Providers"
        description="Browse and deploy MCP server providers."
      />

      <Outlet />
    </ContentLayout>
  );
};

// Backwards export aliases used by existing dynamic imports.
export let ProvidersListLayout = ProvidersHubLayout;

let DeploymentPicker = ({
  instanceId,
  title,
  description,
  close,
  onSelect
}: {
  instanceId: string;
  title: string;
  description: string;
  close: () => void;
  onSelect: (deploymentId: string) => void;
}) => {
  return (
    <>
      <Dialog.Title>{title}</Dialog.Title>
      <Dialog.Description>{description}</Dialog.Description>

      <Spacer size={10} />

      <ProviderDeploymentsList
        searchable
        emptyText="No deployments found. Create a deployment first."
        onDeploymentClick={deployment => {
          close();
          onSelect(deployment.id);
        }}
      />

      <Spacer size={10} />

      <Dialog.Actions>
        <Button size="2" variant="outline" onClick={close}>
          Cancel
        </Button>
      </Dialog.Actions>
    </>
  );
};

let ProviderPicker = ({
  instanceId,
  title,
  description,
  close,
  onSelect
}: {
  instanceId: string;
  title: string;
  description: string;
  close: () => void;
  onSelect: (providerId: string) => void;
}) => {
  return (
    <>
      <Dialog.Title>{title}</Dialog.Title>
      <Dialog.Description>{description}</Dialog.Description>

      <Spacer size={10} />

      <ProvidersWithDeploymentsSearch
        instanceId={instanceId}
        emptyText="No providers found. Create a deployment first."
        onSelect={provider => {
          close();
          onSelect(provider.id);
        }}
      />

      <Spacer size={10} />

      <Dialog.Actions>
        <Button size="2" variant="outline" onClick={close}>
          Cancel
        </Button>
      </Dialog.Actions>
    </>
  );
};

let DeploymentPickerForProvider = ({
  instanceId,
  providerId,
  title,
  description,
  close,
  onSelect,
  onBack
}: {
  instanceId: string;
  providerId: string;
  title: string;
  description: string;
  close: () => void;
  onSelect: (deploymentId: string) => void;
  onBack?: () => void;
}) => {
  return (
    <>
      <Dialog.Title>{title}</Dialog.Title>
      <Dialog.Description>{description}</Dialog.Description>

      <Spacer size={10} />

      <ProviderDeploymentsList
        providerId={providerId}
        searchable
        emptyText="No deployments found for this provider."
        onDeploymentClick={deployment => {
          close();
          onSelect(deployment.id);
        }}
      />

      <Spacer size={10} />

      <Dialog.Actions>
        {onBack && (
          <Button
            size="2"
            variant="outline"
            onClick={() => {
              close();
              onBack();
            }}
          >
            Back
          </Button>
        )}
        <Button size="2" variant="outline" onClick={close}>
          Cancel
        </Button>
      </Dialog.Actions>
    </>
  );
};

let showDeploymentPickerThenCreateConfig = (instanceId: string) =>
  showModal(({ dialogProps, close }) => (
    <Dialog.Wrapper {...dialogProps} width={550}>
      <DeploymentPicker
        instanceId={instanceId}
        title="Create Config"
        description="Select a deployment to create a configuration for."
        close={close}
        onSelect={deploymentId =>
          showProviderConfigFormModal({
            type: 'create',
            instanceId,
            providerDeploymentId: deploymentId,
            onCreate: () => {
              if (typeof window !== 'undefined') {
                window.dispatchEvent(new Event('provider-config-created'));
              }
            },
            onBack: () => showDeploymentPickerThenCreateConfig(instanceId)
          })
        }
      />
    </Dialog.Wrapper>
  ));

let showDeploymentPickerThenCreateConfigVault = (instanceId: string) =>
  showModal(({ dialogProps, close }) => (
    <Dialog.Wrapper {...dialogProps} width={550}>
      <DeploymentPicker
        instanceId={instanceId}
        title="Create Config Vault"
        description="Select a deployment to create a reusable config vault for."
        close={close}
        onSelect={deploymentId =>
          showProviderConfigVaultFormModal({
            type: 'create',
            instanceId,
            providerDeploymentId: deploymentId,
            onCreate: () => {
              if (typeof window !== 'undefined') {
                window.dispatchEvent(new Event('provider-config-vault-created'));
              }
            },
            onBack: () => showDeploymentPickerThenCreateConfigVault(instanceId)
          })
        }
      />
    </Dialog.Wrapper>
  ));

let AuthCredentialsForm = ({
  instanceId,
  providerId,
  deploymentId,
  close,
  onBack,
  onCreate
}: {
  instanceId: string;
  providerId: string;
  deploymentId: string;
  close: () => void;
  onBack?: () => void;
  onCreate?: () => void;
}) => {
  let deployment = useProviderDeployment(instanceId, deploymentId);
  let provider = useProvider(instanceId, providerId);
  let versionId =
    deployment.data?.lockedVersion?.id ?? provider.data?.currentVersion?.id;
  let authMethods = useProviderAuthMethods(instanceId, versionId);
  let oauthMethod = useMemo(
    () => (authMethods.data?.items ?? []).find(m => m.type === 'oauth'),
    [authMethods.data?.items]
  );
  let redirectUri = provider.data?.oauth?.callbackUrl;
  let providerName = deployment.data?.name ?? provider.data?.name ?? providerId;
  let oauthMethodName = oauthMethod?.name ?? 'OAuth';

  let createCredentials = useCreateProviderAuthCredentials();

  let form = useForm({
    initialValues: {
      name: '',
      clientId: '',
      clientSecret: ''
    },
    onSubmit: async () => {},
    schema: yup =>
      yup.object({
        name: yup.string().required('Name is required'),
        clientId: yup.string().required('Client ID is required'),
        clientSecret: yup.string().required('Client Secret is required')
      })
  });

  let handleSubmit = async () => {
    let name = form.values.name.trim();

    if (!name) {
      form.setFieldTouched('name', true);
      form.setFieldError('name', 'Name is required');
      return;
    }

    form.setFieldError('name', undefined);

    let [, err] = await createCredentials.mutate({
      instanceId,
      providerId,
      name,
      config: {
        type: 'oauth',
        clientId: form.values.clientId,
        clientSecret: form.values.clientSecret,
        scopes: oauthMethod?.scopes?.map((s: any) => s.scope) ?? []
      }
    });

    if (err) return;

    close();
    onCreate?.();
  };

  if (deployment.isLoading || authMethods.isLoading) {
    return (
      <>
        <Dialog.Title>Create Auth Credentials</Dialog.Title>
        <Dialog.Description>Loading provider details...</Dialog.Description>
        <Spacer size={15} />
        <CenteredSpinner />
      </>
    );
  }

  return (
    <>
      <Dialog.Title>Create Auth Credentials</Dialog.Title>
      <Dialog.Description>
        Enter your {oauthMethodName} app credentials for {providerName}.
      </Dialog.Description>

      <Spacer size={15} />

      <form
        onSubmit={e => {
          e.preventDefault();
          handleSubmit();
        }}
      >
        {redirectUri && (
          <>
            <Copy label="Redirect URI" value={redirectUri} />
            <Text size="1" color="gray600">
              Use this redirect URI when configuring your OAuth app.
            </Text>

            <Spacer size={10} />
          </>
        )}

        <Input
          label="Name"
          placeholder="My OAuth App"
          required
          {...form.getFieldProps('name')}
        />
        <form.RenderError field="name" />

        <Spacer size={10} />

        <Input
          label="Client ID"
          placeholder="Enter client ID from provider"
          required
          {...form.getFieldProps('clientId')}
        />
        <form.RenderError field="clientId" />

        <Spacer size={10} />

        <Input
          label="Client Secret"
          placeholder="Enter client secret from provider"
          type="password"
          required
          {...form.getFieldProps('clientSecret')}
        />
        <form.RenderError field="clientSecret" />

        <createCredentials.RenderError />

        <Spacer size={15} />

        <Dialog.Actions>
          {onBack && (
            <Button type="button" size="2" variant="outline" onClick={onBack}>
              Back
            </Button>
          )}
          <Button type="button" size="2" variant="outline" onClick={close}>
            Cancel
          </Button>
          <Button
            type="button"
            size="2"
            onClick={handleSubmit}
            loading={createCredentials.isPending}
            disabled={!form.values.name || !form.values.clientId || !form.values.clientSecret}
          >
            Create
          </Button>
        </Dialog.Actions>
      </form>
    </>
  );
};

let showCreateAuthCredentialsFlow = (instanceId: string) =>
  showModal(({ dialogProps, close }) => (
    <Dialog.Wrapper {...dialogProps} width={550}>
      <ProviderPicker
        instanceId={instanceId}
        title="Create Auth Credentials"
        description="Select a provider to create OAuth credentials for."
        close={close}
        onSelect={providerId =>
          showModal(({ dialogProps: depDialogProps, close: depClose }) => (
            <Dialog.Wrapper {...depDialogProps} width={550}>
              <DeploymentPickerForProvider
                instanceId={instanceId}
                providerId={providerId}
                title="Select Deployment"
                description="Choose a deployment to associate these credentials with."
                close={depClose}
                onBack={() => showCreateAuthCredentialsFlow(instanceId)}
                onSelect={deploymentId =>
                  showModal(({ dialogProps: formDialogProps, close: formClose }) => (
                    <Dialog.Wrapper {...formDialogProps} width={550}>
                      <AuthCredentialsForm
                        instanceId={instanceId}
                        providerId={providerId}
                        deploymentId={deploymentId}
                        close={formClose}
                        onBack={() =>
                          showModal(({ dialogProps: backDialogProps, close: backClose }) => (
                            <Dialog.Wrapper {...backDialogProps} width={550}>
                              <DeploymentPickerForProvider
                                instanceId={instanceId}
                                providerId={providerId}
                                title="Select Deployment"
                                description="Choose a deployment to associate these credentials with."
                                close={backClose}
                                onBack={() => showCreateAuthCredentialsFlow(instanceId)}
                                onSelect={newDeploymentId =>
                                  showModal(
                                    ({
                                      dialogProps: innerFormDialogProps,
                                      close: innerFormClose
                                    }) => (
                                      <Dialog.Wrapper {...innerFormDialogProps} width={550}>
                                        <AuthCredentialsForm
                                          instanceId={instanceId}
                                          providerId={providerId}
                                          deploymentId={newDeploymentId}
                                          close={innerFormClose}
                                          onCreate={() => {
                                            if (typeof window !== 'undefined') {
                                              window.dispatchEvent(
                                                new Event(
                                                  'provider-auth-credentials-created'
                                                )
                                              );
                                            }
                                          }}
                                        />
                                      </Dialog.Wrapper>
                                    )
                                  )
                                }
                              />
                            </Dialog.Wrapper>
                          ))
                        }
                        onCreate={() => {
                          if (typeof window !== 'undefined') {
                            window.dispatchEvent(
                              new Event('provider-auth-credentials-created')
                            );
                          }
                        }}
                      />
                    </Dialog.Wrapper>
                  ))
                }
              />
            </Dialog.Wrapper>
          ))
        }
      />
    </Dialog.Wrapper>
  ));

let showDeploymentPickerThenCreateAuthConfig = (instanceId: string) =>
  showModal(({ dialogProps, close }) => (
    <Dialog.Wrapper {...dialogProps} width={550}>
      <ProviderPicker
        instanceId={instanceId}
        title="Create Auth Config"
        description="Select a provider to create an authentication configuration for."
        close={close}
        onSelect={providerId =>
          showModal(({ dialogProps: innerDialogProps, close: innerClose }) => (
            <Dialog.Wrapper {...innerDialogProps} width={550}>
              <DeploymentPickerForProvider
                instanceId={instanceId}
                providerId={providerId}
                title="Select Deployment"
                description="Choose a deployment to attach this auth configuration to."
                close={innerClose}
                onBack={() => showDeploymentPickerThenCreateAuthConfig(instanceId)}
                onSelect={deploymentId =>
                  showProviderSetupSessionModal({
                    instanceId,
                    providerId,
                    deploymentId,
                    onComplete: () => {
                      if (typeof window !== 'undefined') {
                        window.dispatchEvent(new Event('provider-auth-config-created'));
                      }
                    }
                  })
                }
              />
            </Dialog.Wrapper>
          ))
        }
      />
    </Dialog.Wrapper>
  ));

let CredentialsFormStep = ({
  instanceId,
  providerId,
  deploymentId,
  close,
  onBack,
  onCreated
}: {
  instanceId: string;
  providerId: string;
  deploymentId: string;
  close: () => void;
  onBack: () => void;
  onCreated?: () => void;
}) => {
  let deployment = useProviderDeployment(instanceId, deploymentId);
  let provider = useProvider(instanceId, providerId);
  let versionId = deployment.data?.lockedVersion?.id ?? provider.data?.currentVersion?.id;
  let authMethods = useProviderAuthMethods(instanceId, versionId);
  let oauthMethod = useMemo(
    () => (authMethods.data?.items ?? []).find(m => m.type === 'oauth'),
    [authMethods.data?.items]
  );

  let createCredentials = useCreateProviderAuthCredentials();

  let form = useForm({
    initialValues: {
      name: '',
      clientId: '',
      clientSecret: ''
    },
    onSubmit: async () => {},
    schema: yup =>
      yup.object({
        name: yup.string().required('Name is required'),
        clientId: yup.string().required('Client ID is required'),
        clientSecret: yup.string().required('Client Secret is required')
      })
  });

  let handleSubmit = async () => {
    let name = form.values.name.trim();

    if (!name) {
      form.setFieldTouched('name', true);
      form.setFieldError('name', 'Name is required');
      return;
    }

    form.setFieldError('name', undefined);

    let [, err] = await createCredentials.mutate({
      instanceId,
      providerId,
      name,
      config: {
        type: 'oauth',
        clientId: form.values.clientId,
        clientSecret: form.values.clientSecret,
        scopes: oauthMethod?.scopes?.map((s: any) => s.scope) ?? []
      }
    });

    if (err) return;

    close();
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('provider-auth-credentials-created'));
    }
    onCreated?.();
  };

  if (deployment.isLoading || authMethods.isLoading) {
    return <CenteredSpinner />;
  }

  return (
    <form
      onSubmit={e => {
        e.preventDefault();
        handleSubmit();
      }}
    >
      <Text size="2" color="gray600">
        Enter your OAuth app credentials for{' '}
        {deployment.data?.name ?? provider.data?.name ?? providerId}.
      </Text>

      <Spacer size={15} />

      <Input
        label="Name"
        placeholder="My OAuth App"
        required
        {...form.getFieldProps('name')}
      />
      <form.RenderError field="name" />

      <Spacer size={10} />

      <Input
        label="Client ID"
        placeholder="Enter client ID from provider"
        required
        {...form.getFieldProps('clientId')}
      />
      <form.RenderError field="clientId" />

      <Spacer size={10} />

      <Input
        label="Client Secret"
        placeholder="Enter client secret from provider"
        type="password"
        required
        {...form.getFieldProps('clientSecret')}
      />
      <form.RenderError field="clientSecret" />

      <createCredentials.RenderError />

      <Spacer size={15} />

      <Dialog.Actions>
        <Button type="button" variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button
          type="button"
          onClick={handleSubmit}
          loading={createCredentials.isPending}
          disabled={!form.values.name || !form.values.clientId || !form.values.clientSecret}
        >
          Create
        </Button>
      </Dialog.Actions>
    </form>
  );
};

let ConfigureAuthFlow = ({
  instanceId,
  close,
  onCreated,
  variant = 'credentials'
}: {
  instanceId: string;
  close: () => void;
  onCreated?: (deploymentId: string, authConfigId: string) => void;
  variant?: 'credentials' | 'setup-session';
}) => {
  let [step, setStep] = useState(0);
  let [selectedProviderId, setSelectedProviderId] = useState<string | null>(null);
  let [selectedDeploymentId, setSelectedDeploymentId] = useState<string | null>(null);

  if (
    step === 2 &&
    variant === 'setup-session' &&
    selectedProviderId &&
    selectedDeploymentId
  ) {
    return (
      <ProviderSetupSessionEmbed
        instanceId={instanceId}
        providerId={selectedProviderId}
        deploymentId={selectedDeploymentId}
        cancelLabel="Back"
        onCancel={() => setStep(1)}
        onComplete={result => {
          close();
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new Event('provider-auth-config-created'));
          }
          let authConfigId = result?.authConfig?.id;
          if (authConfigId) {
            onCreated?.(selectedDeploymentId!, authConfigId);
          }
        }}
      />
    );
  }

  return (
    <Stepper
      steps={[
        {
          title: 'Provider',
          subtitle: 'Select provider',
          render: () => (
            <>
              <ProvidersWithDeploymentsSearch
                instanceId={instanceId}
                emptyText="No providers found. Create a deployment first."
                onSelect={provider => {
                  setSelectedProviderId(provider.id);
                  setSelectedDeploymentId(null);
                  setStep(1);
                }}
              />

              <Spacer size={10} />

              <Dialog.Actions>
                <Button variant="outline" onClick={close}>
                  Cancel
                </Button>
              </Dialog.Actions>
            </>
          )
        },
        {
          title: 'Deployment',
          subtitle: 'Select deployment',
          render: () => (
            <>
              {selectedProviderId && (
                <ProviderDeploymentsList
                  providerId={selectedProviderId}
                  searchable
                  emptyText="No deployments found for this provider."
                  onDeploymentClick={deployment => {
                    setSelectedDeploymentId(deployment.id);
                    setStep(2);
                  }}
                />
              )}

              <Spacer size={10} />

              <Dialog.Actions>
                <Button
                  variant="outline"
                  onClick={() => {
                    setStep(0);
                    setSelectedProviderId(null);
                  }}
                >
                  Back
                </Button>
                <Button variant="outline" onClick={close}>
                  Cancel
                </Button>
              </Dialog.Actions>
            </>
          )
        },
        {
          title: variant === 'setup-session' ? 'Configure' : 'Credentials',
          subtitle: variant === 'setup-session' ? 'Set up authentication' : 'Create credentials',
          render: () =>
            selectedProviderId && selectedDeploymentId ? (
              <CredentialsFormStep
                instanceId={instanceId}
                providerId={selectedProviderId}
                deploymentId={selectedDeploymentId}
                close={close}
                onBack={() => setStep(1)}
                onCreated={() => onCreated?.(selectedDeploymentId!, '')}
              />
            ) : null
        }
      ]}
      currentStep={step}
      setCurrentStep={setStep}
    />
  );
};

let showConfigureAuthFlow = (
  instanceId: string,
  options?: {
    variant?: 'credentials' | 'setup-session';
    onCreated?: (deploymentId: string, authConfigId: string) => void;
  }
) =>
  showModal(({ dialogProps, close }) => (
    <Dialog.Wrapper {...dialogProps} width={700}>
      <Dialog.Title>Configure Authentication</Dialog.Title>
      <Dialog.Description>
        Set up an authenticated connection for a provider deployment.
      </Dialog.Description>

      <ConfigureAuthFlow
        instanceId={instanceId}
        close={close}
        variant={options?.variant}
        onCreated={options?.onCreated}
      />
    </Dialog.Wrapper>
  ));

export let ProviderDeploymentsListLayout = () => {
  let instance = useCurrentInstance();
  let project = useCurrentProject();
  let organization = useCurrentOrganization();
  let pathname = useLocation().pathname;
  let navigate = useNavigate();

  let pathParams = [organization.data, project.data, instance.data] as const;

  let deploymentsPath = Paths.instance.providerDeployments(...pathParams);
  let configsPath = Paths.instance.providerDeployments(...pathParams, 'configs');
  let configVaultsPath = Paths.instance.providerDeployments(...pathParams, 'config-vaults');
  let authCredentialsPath = Paths.instance.providerDeployments(
    ...pathParams,
    'auth-credentials'
  );
  let authConfigsPath = Paths.instance.providerDeployments(...pathParams, 'auth-configs');

  let activeTab = useMemo(() => {
    if (pathname.endsWith('/auth-credentials')) return 'auth-credentials';
    if (pathname.endsWith('/auth-configs')) return 'auth-configs';
    if (pathname.endsWith('/config-vaults')) return 'config-vaults';
    if (pathname.endsWith('/configs')) return 'configs';
    return 'deployments';
  }, [pathname]);

  let headerProps = useMemo(() => {
    if (activeTab === 'configs') {
      return {
        title: 'Configuration',
        description: 'View and manage provider configuration profiles across your deployments.'
      };
    }
    if (activeTab === 'auth-configs') {
      return {
        title: 'Configuration',
        description: 'View and manage authentication credentials across your deployments.'
      };
    }
    if (activeTab === 'config-vaults') {
      return {
        title: 'Configuration',
        description: 'Manage reusable configuration vaults across your deployments.'
      };
    }
    if (activeTab === 'auth-credentials') {
      return {
        title: 'Configuration',
        description: 'View authenticated connections created through the OAuth flow.'
      };
    }
    return {
      title: 'Configuration',
      description: 'Manage your provider deployments, configs, and authentication.'
    };
  }, [activeTab]);

  let headerAction = useMemo(() => {
    if (activeTab === 'configs') {
      return (
        <Button
          size="2"
          onClick={() => {
            if (instance.data) {
              showDeploymentPickerThenCreateConfig(instance.data.id);
            }
          }}
        >
          Create Config
        </Button>
      );
    }
    if (activeTab === 'config-vaults') {
      return (
        <Button
          size="2"
          onClick={() => {
            if (instance.data) {
              showDeploymentPickerThenCreateConfigVault(instance.data.id);
            }
          }}
        >
          Create Config Vault
        </Button>
      );
    }
    if (activeTab === 'auth-credentials') {
      return (
        <Button
          size="2"
          style={{
            background: theme.colors.gray900,
            borderColor: theme.colors.gray900,
            color: 'white'
          }}
          onClick={() => {
            if (instance.data) {
              showCreateAuthCredentialsFlow(instance.data.id);
            }
          }}
        >
          Create Auth Credentials
        </Button>
      );
    }
    if (activeTab === 'auth-configs') {
      return (
        <Button
          size="2"
          onClick={() => {
            if (instance.data) {
              showConfigureAuthFlow(instance.data.id, {
                variant: 'setup-session',
                onCreated: (deploymentId, authConfigId) => {
                  navigate(
                    Paths.instance.providerAuthConnection(
                      organization.data,
                      project.data,
                      instance.data,
                      deploymentId,
                      authConfigId
                    )
                  );
                }
              });
            }
          }}
        >
          Create Auth Config
        </Button>
      );
    }
    return (
      <Button
        size="2"
        onClick={() =>
          showProviderDeploymentFormModal({
            type: 'create',
            instanceId: instance.data?.id,
            onCreate: deployment => {
              if (!instance.data) return;

              navigate(
                Paths.instance.providerDeployment(
                  organization.data,
                  project.data,
                  instance.data,
                  deployment.id
                )
              );
            }
          })
        }
      >
        Create Deployment
      </Button>
    );
  }, [activeTab, instance.data, navigate, organization.data, project.data]);

  return (
    <ContentLayout>
      <PageHeader
        title={headerProps.title}
        description={headerProps.description}
        actions={headerAction}
      />

      <LinkTabs
        current={pathname}
        links={[
          { label: 'Deployments', to: deploymentsPath },
          { label: 'Configs', to: configsPath },
          { label: 'Vaults', to: configVaultsPath },
          { label: 'Auth Credentials', to: authCredentialsPath },
          { label: 'Auth Configs', to: authConfigsPath }
        ]}
      />

      <Outlet />
    </ContentLayout>
  );
};

export let SessionTemplatesListLayout = () => {
  let instance = useCurrentInstance();
  let organization = useCurrentOrganization();
  let project = useCurrentProject();
  let navigate = useNavigate();

  return (
    <ContentLayout>
      <PageHeader
        title="Session Templates"
        description="Create reusable session configurations for quick deployment."
        actions={
          <Button
            size="2"
            onClick={() =>
              instance.data &&
              showSessionTemplateFormModal({
                type: 'create',
                instanceId: instance.data.id,
                onCreate: template => {
                  if (!instance.data) return;

                  navigate(
                    Paths.instance.sessionTemplate(
                      organization.data,
                      project.data,
                      instance.data,
                      template.id
                    )
                  );
                }
              })
            }
          >
            Create Template
          </Button>
        }
      />

      <Outlet />
    </ContentLayout>
  );
};

export let ProviderSessionsListLayout = () => {
  let instance = useCurrentInstance();
  let project = useCurrentProject();
  let organization = useCurrentOrganization();
  let pathname = useLocation().pathname;

  return (
    <ContentLayout>
      <PageHeader
        title="Logs"
        description="Check the logs of your sessions and MCP servers."
      />

      <LinkTabs
        current={pathname}
        links={[
          {
            label: 'Sessions',
            to: Paths.instance.providerSessions(organization.data, project.data, instance.data)
          },
          {
            label: 'Provider Runs',
            to: Paths.instance.providerRuns(organization.data, project.data, instance.data)
          },
          {
            label: 'Errors',
            to: Paths.instance.providerErrors(organization.data, project.data, instance.data)
          }
        ]}
      />

      <Outlet />
    </ContentLayout>
  );
};
