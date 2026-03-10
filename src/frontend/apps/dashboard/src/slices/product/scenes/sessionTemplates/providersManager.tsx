import {
  DashboardInstanceProviderDeploymentsListOutput,
  DashboardInstanceSessionTemplatesProvidersListOutput
} from '@metorial/dashboard-sdk';
import { renderWithLoader, useForm } from '@metorial/data-hooks';
import {
  useCreateProviderDeployment,
  useCreateSessionTemplateProvider,
  useInstanceProviderAuthConfigs,
  useProviderAuthConfigs,
  useProvider,
  useProviderDeployment,
  useProviderDeployments,
  useProviderListings,
  useProviderTools,
  useSessionTemplateProviders,
  withAuth
} from '@metorial/state';
import {
  Avatar,
  Button,
  CenteredSpinner,
  Dialog,
  Flex,
  Input,
  Select,
  showModal,
  Spacer,
  Text,
  theme
} from '@metorial/ui';
import { Table } from '@metorial/ui-product';
import { RiAddLine } from '@remixicon/react';
import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import {
  emptyConfigurationSelection,
  type ConfigurationSelection
} from '../../lib/configSelection';
import { useProviderAuthCreationCapabilities } from '../../lib/providerCreationCapabilities';
import { showProviderAuthConfigCreateModal } from '../providerAuthConfigs/modal';
import { ProviderConfigurationSelection } from '../providerConfigs/selection';
import { ProviderDeploymentsList } from '../providerDeployments/list';
import { ProviderSearch } from '../providers/search';
import { Stepper } from '../stepper';

type SessionTemplateProviderRow =
  DashboardInstanceSessionTemplatesProvidersListOutput['items'][number];

type AddProviderFormValues = {
  selectedProviderId: string;
  selectedProviderName: string;
  selectedDeploymentId: string;
  selectedConfiguration: ConfigurationSelection;
  selectedAuthConfigId: string;
  toolFilterMode: 'all' | 'select';
  selectedToolKeys: string[];
};

type AddProviderFormRef = {
  setFieldValue: (field: string, value: unknown) => void;
  setFieldTouched: (field: string, touched: boolean, shouldValidate?: boolean) => void;
  setFieldError: (field: string, message?: string) => void;
};

let AddProviderModalContent = ({
  instanceId,
  sessionTemplateId,
  onComplete,
  onCancel
}: {
  instanceId: string;
  sessionTemplateId: string;
  onComplete: () => void;
  onCancel: () => void;
}) => {
  let [currentStep, setCurrentStep] = useState(0);
  let createMutation = useCreateSessionTemplateProvider();
  let formRef = useRef<AddProviderFormRef | null>(null);
  let form = useForm<AddProviderFormValues>({
    initialValues: {
      selectedProviderId: '',
      selectedProviderName: '',
      selectedDeploymentId: '',
      selectedConfiguration: emptyConfigurationSelection(),
      selectedAuthConfigId: '',
      toolFilterMode: 'all' as const,
      selectedToolKeys: [] as string[]
    },
    onSubmit: async values => {
      let [result, err] = await createMutation.mutate({
        instanceId,
        sessionTemplateId,
        providerDeploymentId: values.selectedDeploymentId,
        ...(values.selectedConfiguration.kind === 'config'
          ? {
              providerConfigId: values.selectedConfiguration.id
            }
          : {}),
        ...(values.selectedConfiguration.kind === 'vault'
          ? {
              providerConfigVaultId: values.selectedConfiguration.id
            }
          : {}),
        ...(values.selectedAuthConfigId
          ? {
              providerAuthConfigId: values.selectedAuthConfigId
            }
          : {}),
        ...(values.toolFilterMode === 'select' && values.selectedToolKeys.length > 0
          ? { toolFilters: { toolKeys: values.selectedToolKeys } }
          : {})
      });

      if (!err) {
        if (result) onComplete();
        return;
      }

      let errorCode = err.data?.code;
      let entityId = err.data?.entityId;
      let currentForm = formRef.current;
      if (!currentForm || errorCode !== 'use_after_delete' || !entityId) return;

      if (
        values.selectedConfiguration.kind !== 'none' &&
        entityId === values.selectedConfiguration.id
      ) {
        currentForm.setFieldValue('selectedConfiguration', emptyConfigurationSelection());
        currentForm.setFieldTouched('selectedConfiguration', true, false);
        currentForm.setFieldError(
          'selectedConfiguration',
          values.selectedConfiguration.kind === 'vault'
            ? 'Selected config vault was deleted or archived. Choose another vault or leave Config empty.'
            : 'Selected provider config was deleted or archived. Choose another config or leave Config empty.'
        );
      }

      if (entityId === values.selectedAuthConfigId) {
        currentForm.setFieldValue('selectedAuthConfigId', '');
        currentForm.setFieldTouched('selectedAuthConfigId', true, false);
        currentForm.setFieldError(
          'selectedAuthConfigId',
          'Selected auth config was deleted or archived. Choose another auth config or leave Auth Config empty.'
        );
      }
    },
    schema: yup =>
      yup.object({
        selectedProviderId: yup.string().defined(),
        selectedProviderName: yup.string().defined(),
        selectedDeploymentId: yup.string().required('Deployment is required'),
        selectedConfiguration: yup.mixed<ConfigurationSelection>().defined(),
        selectedAuthConfigId: yup.string().optional().default(''),
        toolFilterMode: yup
          .mixed<'all' | 'select'>()
          .oneOf(['all', 'select'])
          .required(),
        selectedToolKeys: yup.array().of(yup.string().required()).defined()
      })
  });
  formRef.current = form;

  let resetConfigurationState = () => {
    form.setFieldValue('selectedConfiguration', emptyConfigurationSelection());
    form.setFieldValue('selectedAuthConfigId', '');
    form.setFieldValue('toolFilterMode', 'all');
    form.setFieldValue('selectedToolKeys', []);
    form.setFieldTouched('selectedConfiguration', false, false);
    form.setFieldTouched('selectedAuthConfigId', false, false);
    form.setFieldError('selectedConfiguration', undefined);
    form.setFieldError('selectedAuthConfigId', undefined);
  };

  return (
    <Stepper
      currentStep={currentStep}
      setCurrentStep={setCurrentStep}
      steps={[
        {
          title: 'Provider',
          subtitle: 'Choose a provider',
          render: () => (
            <PickProviderStep
              onSelect={(providerId, providerName) => {
                form.setFieldValue('selectedProviderId', providerId);
                form.setFieldValue('selectedProviderName', providerName);
                form.setFieldValue('selectedDeploymentId', '');
                form.setFieldTouched('selectedDeploymentId', false, false);
                form.setFieldError('selectedDeploymentId', undefined);
                resetConfigurationState();
                setCurrentStep(1);
              }}
            />
          )
        },
        {
          title: 'Deployment',
          subtitle: 'Select a deployment',
          render: () => (
            <PickDeploymentStep
              instanceId={instanceId}
              providerId={form.values.selectedProviderId}
              providerName={form.values.selectedProviderName}
              onSelect={deploymentId => {
                form.setFieldValue('selectedDeploymentId', deploymentId);
                form.setFieldTouched('selectedDeploymentId', false, false);
                form.setFieldError('selectedDeploymentId', undefined);
                resetConfigurationState();
                setCurrentStep(2);
              }}
            />
          )
        },
        {
          title: 'Configure',
          subtitle: 'Set up the provider',
          render: () => (
            <DeploymentConfigureStep
              instanceId={instanceId}
              deploymentId={form.values.selectedDeploymentId}
              providerId={form.values.selectedProviderId}
              providerName={form.values.selectedProviderName}
              selectedConfiguration={form.values.selectedConfiguration}
              setSelectedConfiguration={value => {
                form.setFieldValue('selectedConfiguration', value);
                form.setFieldTouched('selectedConfiguration', false, false);
                form.setFieldError('selectedConfiguration', undefined);
              }}
              selectedAuthConfigId={form.values.selectedAuthConfigId}
              setSelectedAuthConfigId={value => {
                form.setFieldValue('selectedAuthConfigId', value);
                form.setFieldTouched('selectedAuthConfigId', false, false);
                form.setFieldError('selectedAuthConfigId', undefined);
              }}
              toolFilterMode={form.values.toolFilterMode}
              setToolFilterMode={value => form.setFieldValue('toolFilterMode', value)}
              selectedToolKeys={form.values.selectedToolKeys}
              setSelectedToolKeys={value => form.setFieldValue('selectedToolKeys', value)}
              saving={createMutation.isPending}
              configError={<form.RenderError field="selectedConfiguration" />}
              authConfigError={<form.RenderError field="selectedAuthConfigId" />}
              mutationError={<createMutation.RenderError />}
              onSave={form.submitForm}
            />
          )
        }
      ]}
    />
  );
};

let PickProviderStep = ({
  onSelect
}: {
  onSelect: (providerId: string, providerName: string) => void;
}) => {
  return (
    <ProviderSearch
      limit={21}
      onSelect={provider =>
        onSelect(provider.id, provider.name ?? provider.slug ?? 'Provider')
      }
    />
  );
};

let CreateDeploymentInline = ({
  instanceId,
  providerId,
  providerName,
  onCreated
}: {
  instanceId: string;
  providerId: string;
  providerName: string;
  onCreated: (deploymentId: string) => void;
}) => {
  let createMutation = useCreateProviderDeployment();
  let form = useForm({
    initialValues: {
      name: providerName,
      description: ''
    },
    onSubmit: async () => {},
    schema: yup =>
      yup.object({
        name: yup.string().required('Name is required'),
        description: yup.string().defined()
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

    let [result] = await createMutation.mutate({
      instanceId,
      name,
      providerId,
      description: form.values.description.trim() || undefined
    });

    if (result) onCreated(result.id);
  };

  return (
    <Flex direction="column" gap={12}>
      <Text size="2" color="gray600">
        No deployments found for <strong>{providerName}</strong>. Create one to continue.
      </Text>

      <Input label="Name" required {...form.getFieldProps('name')} />
      <form.RenderError field="name" />

      <Input label="Description" {...form.getFieldProps('description')} />

      <createMutation.RenderError />

      <Dialog.Actions>
        <Button type="button" onClick={handleSubmit} loading={createMutation.isPending}>
          Create Deployment
        </Button>
      </Dialog.Actions>
    </Flex>
  );
};

let PickDeploymentStep = ({
  instanceId,
  providerId,
  providerName,
  onSelect
}: {
  instanceId: string;
  providerId: string;
  providerName: string;
  onSelect: (id: string) => void;
}) => {
  let deployments = useProviderDeployments(instanceId, { providerId });
  let items: DashboardInstanceProviderDeploymentsListOutput['items'] = deployments.data?.items ?? [];
  let singleDeploymentId = items.length === 1 ? items[0]?.id : null;

  useEffect(() => {
    if (singleDeploymentId) {
      onSelect(singleDeploymentId);
    }
  }, [onSelect, singleDeploymentId]);

  if (deployments.isLoading) return <CenteredSpinner />;

  if (items.length === 0) {
    return (
      <CreateDeploymentInline
        instanceId={instanceId}
        providerId={providerId}
        providerName={providerName}
        onCreated={onSelect}
      />
    );
  }

  return (
    <Flex direction="column" gap={12}>
      <Text size="2" color="gray600">
        Select a deployment for <strong>{providerName}</strong>
      </Text>

      <ProviderDeploymentsList
        providerId={providerId}
        searchable
        compact
        columns={3}
        sectionLabel="Deployments"
        emptyText={`No deployments found for ${providerName}.`}
        onDeploymentClick={deployment => onSelect(deployment.id)}
      />
    </Flex>
  );
};

let DeploymentConfigureStep = ({
  instanceId,
  deploymentId,
  providerId,
  providerName,
  selectedConfiguration,
  setSelectedConfiguration,
  selectedAuthConfigId,
  setSelectedAuthConfigId,
  toolFilterMode,
  setToolFilterMode,
  selectedToolKeys,
  setSelectedToolKeys,
  saving,
  configError,
  authConfigError,
  mutationError,
  onSave
}: {
  instanceId: string;
  deploymentId: string;
  providerId: string;
  providerName: string;
  selectedConfiguration: ConfigurationSelection;
  setSelectedConfiguration: (v: ConfigurationSelection) => void;
  selectedAuthConfigId: string;
  setSelectedAuthConfigId: (v: string) => void;
  toolFilterMode: 'all' | 'select';
  setToolFilterMode: (v: 'all' | 'select') => void;
  selectedToolKeys: string[];
  setSelectedToolKeys: (v: string[]) => void;
  saving: boolean;
  configError: ReactNode;
  authConfigError: ReactNode;
  mutationError: ReactNode;
  onSave: () => void;
}) => {
  let authConfigs = useProviderAuthConfigs(instanceId, deploymentId);
  let deployment = useProviderDeployment(instanceId, deploymentId);
  let provider = useProvider(instanceId, providerId);
  let providerVersionId =
    deployment.data?.lockedVersion?.id ?? provider.data?.currentVersion?.id ?? null;
  let tools = useProviderTools(instanceId, providerVersionId);
  let authCreation = useProviderAuthCreationCapabilities(
    instanceId,
    deploymentId,
    providerId
  );
  let authConfigItems = authConfigs.data?.items ?? [];
  let toolItems = tools.data?.items ?? [];

  useEffect(() => {
    if (authConfigs.isLoading || !selectedAuthConfigId) return;
    if (!authConfigItems.some(item => item.id === selectedAuthConfigId)) {
      setSelectedAuthConfigId('');
    }
  }, [
    authConfigs.isLoading,
    authConfigItems,
    selectedAuthConfigId,
    setSelectedAuthConfigId
  ]);

  if (
    deployment.isLoading ||
    authConfigs.isLoading ||
    (deployment.data && !deployment.data.lockedVersion?.id && provider.isLoading) ||
    tools.isLoading
  ) {
    return <CenteredSpinner />;
  }

  return (
    <Flex direction="column" gap={12}>
      <Text size="2" color="gray600">
        Configure <strong>{providerName}</strong>
      </Text>

      <ProviderConfigurationSelection
        instanceId={instanceId}
        providerDeploymentId={deploymentId}
        value={selectedConfiguration}
        onChange={setSelectedConfiguration}
        label="Config"
      />
      {configError}

      <Flex gap={8} align="end">
        <div style={{ flex: 1 }}>
          <Select
            label="Auth Config"
            value={selectedAuthConfigId || '__none__'}
            onChange={v => setSelectedAuthConfigId(v === '__none__' ? '' : v)}
            items={[
              { id: '__none__', label: 'None' },
              ...authConfigItems.map(config => ({
                id: config.id,
                label: config.name ?? config.id
              }))
            ]}
          />
        </div>

        <div
          title={authCreation.authConfigDisabledReason ?? undefined}
          style={{ display: 'inline-flex' }}
        >
          <Button
            type="button"
            size="3"
            iconLeft={<RiAddLine />}
            aria-label="Create Auth Config"
            disabled={!authCreation.canCreateAuthConfig}
            onClick={() =>
              showProviderAuthConfigCreateModal({
                instanceId,
                providerDeploymentId: deploymentId,
                onCreate: authConfig => {
                  authConfigs.refetch?.();
                  setSelectedAuthConfigId(authConfig.id);
                }
              })
            }
          />
        </div>
      </Flex>
      {authConfigError}

      {toolItems.length > 0 && (
        <div>
          <Text size="2" weight="strong" style={{ display: 'block', marginBottom: 6 }}>
            Tool Filters
          </Text>

          <Flex direction="column" gap={6}>
            <label
              style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}
            >
              <input
                type="radio"
                checked={toolFilterMode === 'all'}
                onChange={() => {
                  setToolFilterMode('all');
                  setSelectedToolKeys([]);
                }}
              />
              <Text size="2">All tools ({toolItems.length})</Text>
            </label>

            <label
              style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}
            >
              <input
                type="radio"
                checked={toolFilterMode === 'select'}
                onChange={() => setToolFilterMode('select')}
              />
              <Text size="2">Select specific tools</Text>
            </label>

            {toolFilterMode === 'select' && (
              <Flex
                direction="column"
                gap={4}
                style={{
                  marginLeft: 24,
                  maxHeight: 200,
                  overflow: 'auto',
                  padding: '8px 0'
                }}
              >
                {toolItems.map(tool => (
                  <label
                    key={tool.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      cursor: 'pointer'
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={selectedToolKeys.includes(tool.key ?? tool.name)}
                      onChange={e => {
                        let key = tool.key ?? tool.name;
                        if (e.target.checked) {
                          setSelectedToolKeys([...selectedToolKeys, key]);
                        } else {
                          setSelectedToolKeys(selectedToolKeys.filter(k => k !== key));
                        }
                      }}
                    />
                    <Text size="1">{tool.name}</Text>
                  </label>
                ))}
              </Flex>
            )}
          </Flex>
        </div>
      )}

      {mutationError}

      <Dialog.Actions>
        <Button onClick={onSave} loading={saving}>
          Add Provider
        </Button>
      </Dialog.Actions>
    </Flex>
  );
};

export let showAddProviderModal = (p: {
  instanceId: string;
  sessionTemplateId: string;
  onComplete: () => void;
}) =>
  showModal(({ dialogProps, close }) => (
    <Dialog.Wrapper {...dialogProps} width={650}>
      <Dialog.Title>Add Provider</Dialog.Title>
      <Dialog.Description>Select a provider to add to this template.</Dialog.Description>

      <AddProviderModalContent
        instanceId={p.instanceId}
        sessionTemplateId={p.sessionTemplateId}
        onComplete={() => {
          p.onComplete();
          close();
        }}
        onCancel={close}
      />
    </Dialog.Wrapper>
  ));

let showRemoveProviderModal = (p: {
  instanceId: string;
  sessionTemplateId: string;
  provider: SessionTemplateProviderRow;
  displayName: string;
  onComplete: () => void;
}) =>
  showModal(({ dialogProps, close }) => {
    let [loading, setLoading] = useState(false);

    return (
      <Dialog.Wrapper {...dialogProps} width={450}>
        <Dialog.Title>Remove Provider</Dialog.Title>
        <Dialog.Description>
          Are you sure you want to remove <strong>{p.displayName}</strong> from this template?
          Sessions created from this template will no longer include this provider.
        </Dialog.Description>

        <Spacer size={20} />

        <Dialog.Actions>
          <Button variant="outline" onClick={close} disabled={loading}>
            Cancel
          </Button>
          <Button
            color="red"
            loading={loading}
            onClick={async () => {
              setLoading(true);
              try {
                await withAuth(sdk =>
                  sdk.sessionTemplates.providers.delete(p.instanceId, p.provider.id)
                );
                p.onComplete();
                close();
              } catch {
                setLoading(false);
              }
            }}
          >
            Remove
          </Button>
        </Dialog.Actions>
      </Dialog.Wrapper>
    );
  });

export let SessionTemplateProvidersManager = ({
  instanceId,
  sessionTemplateId
}: {
  instanceId: string;
  sessionTemplateId: string;
}) => {
  let providers = useSessionTemplateProviders(instanceId, sessionTemplateId);
  let listings = useProviderListings({});
  let deployments = useProviderDeployments(instanceId);
  let items = providers.data?.items ?? [];
  let authConfigProviderIds = useMemo(
    () =>
      Array.from(
        new Set(items.map(item => item.providerId ?? null).filter((v): v is string => !!v))
      ),
    [items]
  );
  let authConfigs = useInstanceProviderAuthConfigs(instanceId, {
    providerId: authConfigProviderIds.length > 0 ? authConfigProviderIds : undefined
  });

  let authConfigNameLookup = useMemo(() => {
    let lookup: Record<string, string> = {};
    for (let item of authConfigs.data?.items ?? []) {
      lookup[item.id] =
        item.name ?? (item.isDefault ? 'Default Auth Config' : 'Unnamed Auth Config');
    }
    return lookup;
  }, [authConfigs.data?.items]);

  return renderWithLoader({ providers, listings, deployments })(() => {
      let listingLookup: Record<string, { name: string; imageUrl: string }> = {};
      for (let l of listings.data?.items ?? []) {
        let providerId = l.provider?.id;
        if (!providerId) continue;
        listingLookup[providerId] = { name: l.name, imageUrl: l.imageUrl };
      }

      let deploymentLookup: Record<string, string> = {};
      for (let d of deployments.data?.items ?? []) {
        if (d.name) deploymentLookup[d.id] = d.name;
      }

      if (!providers.data || providers.data.items.length === 0) {
        return (
          <Flex
            direction="column"
            gap={12}
            style={{
              alignItems: 'center',
              justifyContent: 'center',
              padding: '48px 24px',
              border: `1px dashed ${theme.colors.gray300}`,
              borderRadius: 12,
              background: theme.colors.gray100
            }}
          >
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 12,
                background: theme.colors.gray200,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 22
              }}
            >
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke={theme.colors.gray500}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="2" y="2" width="20" height="8" rx="2" ry="2" />
                <rect x="2" y="14" width="20" height="8" rx="2" ry="2" />
                <line x1="6" y1="6" x2="6.01" y2="6" />
                <line x1="6" y1="18" x2="6.01" y2="18" />
              </svg>
            </div>

            <Flex direction="column" gap={4} style={{ alignItems: 'center' }}>
              <Text size="2" weight="strong">
                No providers configured
              </Text>
              <Text size="2" color="gray600" align="center" style={{ maxWidth: 320 }}>
                Add providers to this template so sessions created from it will automatically
                include them.
              </Text>
            </Flex>

            <Spacer size={4} />

            <Button
              size="2"
              onClick={() =>
                showAddProviderModal({
                  instanceId,
                  sessionTemplateId,
                  onComplete: () => providers.refetch()
                })
              }
            >
              Add Provider
            </Button>
          </Flex>
        );
      }

      return (
        <Table
          headers={['Provider', 'Deployment', 'Config', 'Auth Config', '']}
          data={providers.data.items.map(provider => {
            let providerId = provider.providerId;
            let listing = providerId ? listingLookup[providerId] : undefined;
            let providerName = listing?.name ?? providerId;
            let deploymentId = provider.deployment.id;
            let deploymentName =
              provider.deployment.name ??
              (deploymentId ? (deploymentLookup[deploymentId] ?? null) : null);
            let configName = provider.config.name ?? null;
            let configId = provider.config.id;
            let authConfigId = provider.authConfig?.id ?? null;
            let authConfigLabel = authConfigId
              ? (authConfigNameLookup[authConfigId] ?? null)
              : null;

            return {
              data: [
                <Flex gap={10} style={{ alignItems: 'center' }}>
                  <Avatar
                    entity={{ name: providerName, photoUrl: listing?.imageUrl }}
                    size={24}
                    radius={6}
                    noTooltip
                    imageFit="contain"
                  />
                  <Text size="2" weight="strong">
                    {providerName}
                  </Text>
                </Flex>,

                deploymentName ? (
                  <Text size="2">{deploymentName}</Text>
                ) : (
                  <Text size="2" color="gray500">
                    —
                  </Text>
                ),

                configName || configId ? (
                  <Text size="2">{configName ?? configId}</Text>
                ) : (
                  <Text size="2" color="gray500">
                    —
                  </Text>
                ),

                authConfigLabel ? (
                  <Text size="2">{authConfigLabel}</Text>
                ) : (
                  <Text size="2" color="gray500">
                    —
                  </Text>
                ),

                <Button
                  size="1"
                  variant="outline"
                  onClick={e => {
                    e.preventDefault();
                    e.stopPropagation();
                    showRemoveProviderModal({
                      instanceId,
                      sessionTemplateId,
                      provider,
                      displayName: providerName,
                      onComplete: () => providers.refetch()
                    });
                  }}
                >
                  Remove
                </Button>
              ]
            };
          })}
        />
      );
    }
  );
};
