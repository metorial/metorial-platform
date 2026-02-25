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
import { showProviderConfigFormModal } from '../../../scenes/providerConfigs/modal';
import { showProviderDeploymentFormModal } from '../../../scenes/providerDeployments/modal';
import { ProviderSetupSessionEmbed } from '../../../scenes/providerDeployments/setupSessionEmbed';
import { showProviderSetupSessionModal } from '../../../scenes/providerDeployments/setupSessionModal';
import { SmallItemGrid } from '../../../scenes/shared/smallItemGrid';
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
  let deployments = useProviderDeployments(instanceId);
  let items = deployments.data?.items ?? [];
  let [search, setSearch] = useState('');
  let filteredItems = items.filter(dep => {
    if (!search.trim()) return true;
    let query = search.toLowerCase();
    return (
      (dep.name ?? '').toLowerCase().includes(query) ||
      dep.providerId.toLowerCase().includes(query)
    );
  });

  return (
    <>
      <Dialog.Title>{title}</Dialog.Title>
      <Dialog.Description>{description}</Dialog.Description>

      <Spacer size={10} />

      {deployments.isLoading && (
        <Text size="2" color="gray600">
          Loading deployments...
        </Text>
      )}

      {!deployments.isLoading && items.length === 0 && (
        <Text size="2" color="gray600">
          No deployments found. Create a deployment first.
        </Text>
      )}

      {!deployments.isLoading && items.length > 0 && (
        <>
          <Input
            label="Search deployments"
            hideLabel
            placeholder="Search deployments..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <Spacer size={10} />
          <SmallItemGrid
            items={filteredItems.map(dep => ({
              id: dep.id,
              label: dep.name ?? dep.providerId ?? 'Unnamed',
              onSelect: () => {
                close();
                onSelect(dep.id);
              }
            }))}
            emptyText="No deployments found matching your search."
          />
        </>
      )}

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
  let deployments = useProviderDeployments(instanceId);
  let items = deployments.data?.items ?? [];
  let [search, setSearch] = useState('');

  let providers = useMemo(() => {
    let byId = new Map<string, { providerId: string; label: string }>();

    for (let dep of items) {
      if (!byId.has(dep.providerId)) {
        byId.set(dep.providerId, {
          providerId: dep.providerId,
          label: dep.name ?? dep.providerId
        });
      }
    }

    return Array.from(byId.values());
  }, [items]);

  let filteredProviders = providers.filter(provider => {
    if (!search.trim()) return true;
    let query = search.toLowerCase();
    return (
      provider.label.toLowerCase().includes(query) ||
      provider.providerId.toLowerCase().includes(query)
    );
  });

  return (
    <>
      <Dialog.Title>{title}</Dialog.Title>
      <Dialog.Description>{description}</Dialog.Description>

      <Spacer size={10} />

      {deployments.isLoading && (
        <Text size="2" color="gray600">
          Loading providers...
        </Text>
      )}

      {!deployments.isLoading && providers.length === 0 && (
        <Text size="2" color="gray600">
          No providers found. Create a deployment first.
        </Text>
      )}

      {!deployments.isLoading && providers.length > 0 && (
        <>
          <Input
            label="Search providers"
            hideLabel
            placeholder="Search providers..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <Spacer size={10} />
          <SmallItemGrid
            items={filteredProviders.map(provider => ({
              id: provider.providerId,
              label: provider.label,
              onSelect: () => {
                close();
                onSelect(provider.providerId);
              }
            }))}
            emptyText="No providers found matching your search."
          />
        </>
      )}

      <Spacer size={10} />

      <Dialog.Actions>
        <Button size="2" variant="outline" onClick={close}>
          Cancel
        </Button>
      </Dialog.Actions>
    </>
  );
};

let DeploymentList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 360px;
  overflow-y: auto;
`;

let DeploymentCard = styled.button`
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 12px 14px;
  border: 1px solid ${theme.colors.gray300};
  border-radius: 8px;
  background: none;
  text-align: left;
  width: 100%;
  cursor: pointer;
  transition:
    border-color 0.15s,
    background 0.15s;

  &:hover {
    border-color: ${theme.colors.gray500};
    background: ${theme.colors.gray100};
  }
`;

let DeploymentCardRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
`;

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
  let deployments = useProviderDeployments(instanceId);
  let items = deployments.data?.items ?? [];
  let [search, setSearch] = useState('');

  let filtered = useMemo(() => {
    let forProvider = items.filter(dep => dep.providerId === providerId);
    if (!search.trim()) return forProvider;
    let query = search.toLowerCase();
    return forProvider.filter(
      dep =>
        (dep.name ?? '').toLowerCase().includes(query) ||
        (dep.description ?? '').toLowerCase().includes(query)
    );
  }, [items, providerId, search]);

  return (
    <>
      <Dialog.Title>{title}</Dialog.Title>
      <Dialog.Description>{description}</Dialog.Description>

      <Spacer size={10} />

      {deployments.isLoading && (
        <Text size="2" color="gray600">
          Loading deployments...
        </Text>
      )}

      {!deployments.isLoading && filtered.length === 0 && (
        <Text size="2" color="gray600">
          No deployments found for this provider.
        </Text>
      )}

      {!deployments.isLoading && filtered.length > 0 && (
        <>
          {filtered.length > 4 && (
            <>
              <Input
                label="Search deployments"
                hideLabel
                placeholder="Search deployments..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
              <Spacer size={10} />
            </>
          )}
          <DeploymentList>
            {filtered.map(dep => (
              <DeploymentCard
                key={dep.id}
                type="button"
                onClick={() => {
                  close();
                  onSelect(dep.id);
                }}
              >
                <DeploymentCardRow>
                  <Text size="2" weight="strong">
                    {dep.name ?? 'Unnamed Deployment'}
                  </Text>
                  {dep.lockedVersion ? (
                    <Badge color="purple" size="1">
                      {dep.lockedVersion.version}
                    </Badge>
                  ) : (
                    <Badge color="gray" size="1">
                      Default
                    </Badge>
                  )}
                </DeploymentCardRow>
                <Text size="1" color="gray500">
                  <RenderDate date={dep.createdAt} />
                </Text>
              </DeploymentCard>
            ))}
          </DeploymentList>
        </>
      )}

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

  let createCredentials = useCreateProviderAuthCredentials();

  let form = useForm({
    initialValues: {
      name: '',
      clientId: '',
      clientSecret: ''
    },
    onSubmit: async values => {
      let [result, err] = await createCredentials.mutate({
        instanceId,
        providerId,
        name: values.name,
        config: {
          type: 'oauth',
          clientId: values.clientId,
          clientSecret: values.clientSecret,
          scopes: oauthMethod?.scopes?.map((s: any) => s.scope) ?? []
        }
      });

      if (err) return;

      close();
      onCreate?.();
    },
    schema: yup =>
      yup.object({
        name: yup.string().required('Name is required'),
        clientId: yup.string().required('Client ID is required'),
        clientSecret: yup.string().required('Client Secret is required')
      })
  });

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
        Enter your OAuth app credentials for{' '}
        {deployment.data?.name ?? provider.data?.name ?? providerId}.
      </Dialog.Description>

      <Spacer size={15} />

      <form onSubmit={form.handleSubmit}>
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
            type="submit"
            size="2"
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
                                                new Event('provider-auth-config-created')
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
                            window.dispatchEvent(new Event('provider-auth-config-created'));
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
    onSubmit: async values => {
      let [, err] = await createCredentials.mutate({
        instanceId,
        providerId,
        name: values.name,
        config: {
          type: 'oauth',
          clientId: values.clientId,
          clientSecret: values.clientSecret,
          scopes: oauthMethod?.scopes?.map((s: any) => s.scope) ?? []
        }
      });

      if (err) return;

      close();
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('provider-auth-config-created'));
      }
      onCreated?.();
    },
    schema: yup =>
      yup.object({
        name: yup.string().required('Name is required'),
        clientId: yup.string().required('Client ID is required'),
        clientSecret: yup.string().required('Client Secret is required')
      })
  });

  if (deployment.isLoading || authMethods.isLoading) {
    return <CenteredSpinner />;
  }

  return (
    <form onSubmit={form.handleSubmit}>
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
          type="submit"
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
  let deployments = useProviderDeployments(instanceId);
  let items = deployments.data?.items ?? [];

  let [step, setStep] = useState(0);
  let [selectedProviderId, setSelectedProviderId] = useState<string | null>(null);
  let [selectedDeploymentId, setSelectedDeploymentId] = useState<string | null>(null);
  let [providerSearch, setProviderSearch] = useState('');
  let [deploymentSearch, setDeploymentSearch] = useState('');

  let providers = useMemo(() => {
    let byId = new Map<string, { providerId: string; label: string }>();
    for (let dep of items) {
      if (!byId.has(dep.providerId)) {
        byId.set(dep.providerId, {
          providerId: dep.providerId,
          label: dep.name ?? dep.providerId
        });
      }
    }
    return Array.from(byId.values());
  }, [items]);

  let filteredProviders = providers.filter(provider => {
    if (!providerSearch.trim()) return true;
    let query = providerSearch.toLowerCase();
    return (
      provider.label.toLowerCase().includes(query) ||
      provider.providerId.toLowerCase().includes(query)
    );
  });

  let allDeploymentsForProvider = useMemo(() => {
    if (!selectedProviderId) return [];
    return items.filter(dep => dep.providerId === selectedProviderId);
  }, [items, selectedProviderId]);

  let filteredDeployments = useMemo(() => {
    if (!deploymentSearch.trim()) return allDeploymentsForProvider;
    let query = deploymentSearch.toLowerCase();
    return allDeploymentsForProvider.filter(
      dep =>
        (dep.name ?? '').toLowerCase().includes(query) ||
        (dep.description ?? '').toLowerCase().includes(query)
    );
  }, [allDeploymentsForProvider, deploymentSearch]);

  if (deployments.isLoading) {
    return <CenteredSpinner />;
  }

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
              {providers.length === 0 ? (
                <Text size="2" color="gray600">
                  No providers found. Create a deployment first.
                </Text>
              ) : (
                <>
                  <Input
                    label="Search providers"
                    hideLabel
                    placeholder="Search providers..."
                    value={providerSearch}
                    onChange={e => setProviderSearch(e.target.value)}
                  />
                  <Spacer size={10} />
                  <SmallItemGrid
                    items={filteredProviders.map(provider => ({
                      id: provider.providerId,
                      label: provider.label,
                      onSelect: () => {
                        setSelectedProviderId(provider.providerId);
                        setSelectedDeploymentId(null);
                        setDeploymentSearch('');
                        setStep(1);
                      }
                    }))}
                    emptyText="No providers found matching your search."
                  />
                </>
              )}

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
              {allDeploymentsForProvider.length === 0 ? (
                <Text size="2" color="gray600">
                  No deployments found for this provider.
                </Text>
              ) : (
                <>
                  {allDeploymentsForProvider.length > 4 && (
                    <>
                      <Input
                        label="Search deployments"
                        hideLabel
                        placeholder="Search deployments..."
                        value={deploymentSearch}
                        onChange={e => setDeploymentSearch(e.target.value)}
                      />
                      <Spacer size={10} />
                    </>
                  )}
                  <DeploymentList>
                    {filteredDeployments.map(dep => (
                      <DeploymentCard
                        key={dep.id}
                        type="button"
                        onClick={() => {
                          setSelectedDeploymentId(dep.id);
                          setStep(2);
                        }}
                      >
                        <DeploymentCardRow>
                          <Text size="2" weight="strong">
                            {dep.name ?? 'Unnamed Deployment'}
                          </Text>
                          {dep.lockedVersion ? (
                            <Badge color="purple" size="1">
                              {dep.lockedVersion.version}
                            </Badge>
                          ) : (
                            <Badge color="gray" size="1">
                              Default
                            </Badge>
                          )}
                        </DeploymentCardRow>
                        <Text size="1" color="gray500">
                          <RenderDate date={dep.createdAt} />
                        </Text>
                      </DeploymentCard>
                    ))}
                  </DeploymentList>
                </>
              )}

              <Spacer size={10} />

              <Dialog.Actions>
                <Button
                  variant="outline"
                  onClick={() => {
                    setStep(0);
                    setSelectedProviderId(null);
                    setProviderSearch('');
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
  let authCredentialsPath = Paths.instance.providerDeployments(
    ...pathParams,
    'auth-credentials'
  );
  let authConfigsPath = Paths.instance.providerDeployments(...pathParams, 'auth-configs');

  let activeTab = useMemo(() => {
    if (pathname.endsWith('/auth-credentials')) return 'auth-credentials';
    if (pathname.endsWith('/auth-configs')) return 'auth-configs';
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
              showConfigureAuthFlow(instance.data.id);
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
            type: 'create'
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
          { label: 'Auth Credentials', to: authCredentialsPath },
          { label: 'Auth Configs', to: authConfigsPath }
        ]}
      />

      <Outlet />
    </ContentLayout>
  );
};

export let SessionTemplatesListLayout = () => {
  return (
    <ContentLayout>
      <PageHeader
        title="Session Templates"
        description="Create reusable session configurations for quick deployment."
        actions={
          <Button
            size="2"
            onClick={() =>
              showSessionTemplateFormModal({
                type: 'create'
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
