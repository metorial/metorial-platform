import {
  DashboardInstanceProviderDeploymentsConfigsListQuery,
  DashboardInstanceSessionTemplatesProvidersListOutput
} from '@metorial/dashboard-sdk';
import { renderWithLoader, useForm } from '@metorial/data-hooks';
import {
  useCurrentInstance,
  useCreateSessionTemplateProvider,
  useProviderAuthConfigs,
  useProvider,
  useProviderDeployment,
  useProviderConfigs,
  useProviderDeployments,
  useProviderListings,
  useProviderTools,
  useSessionTemplate,
  useSessionTemplateProviders,
  withAuth
} from '@metorial/state';
import {
  Avatar,
  Badge,
  Button,
  CenteredSpinner,
  Dialog,
  Flex,
  RenderDate,
  Select,
  showModal,
  Spacer,
  Text,
  theme
} from '@metorial/ui';
import { Table } from '@metorial/ui-product';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ProviderDeploymentsList } from '../../../scenes/providerDeployments/list';
import { ProvidersWithDeploymentsSearch } from '../../../scenes/providers/search';
import { Stepper } from '../../../scenes/stepper';

type Deployment = {
  id: string;
  name: string | null;
  providerId: string;
  provider?: {
    id: string;
    name: string;
    slug?: string | null;
    imageUrl?: string | null;
  } | null;
};

type SessionTemplateProviderRow =
  DashboardInstanceSessionTemplatesProvidersListOutput['items'][number];

type AddProviderFormValues = {
  selectedProviderId: string;
  selectedProviderName: string;
  selectedDeploymentId: string;
  selectedConfigId: string;
  selectedAuthConfigId: string;
  toolFilterMode: 'all' | 'select';
  selectedToolKeys: string[];
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
  let formRef = useRef<any>(null);
  let form = useForm<AddProviderFormValues>({
    initialValues: {
      selectedProviderId: '',
      selectedProviderName: '',
      selectedDeploymentId: '',
      selectedConfigId: '',
      selectedAuthConfigId: '',
      toolFilterMode: 'all' as const,
      selectedToolKeys: [] as string[]
    },
    onSubmit: async values => {
      let [result, err] = await createMutation.mutate({
        instanceId,
        sessionTemplateId,
        providerDeploymentId: values.selectedDeploymentId,
        ...(values.selectedConfigId
          ? {
              providerConfigId: values.selectedConfigId
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

      if (entityId === values.selectedConfigId) {
        currentForm.setFieldValue('selectedConfigId', '');
        currentForm.setFieldTouched('selectedConfigId', true, false);
        currentForm.setFieldError(
          'selectedConfigId',
          'Selected provider config was deleted or archived. Choose another config or leave Config empty.'
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
        selectedConfigId: yup.string().defined(),
        selectedAuthConfigId: yup.string().defined(),
        toolFilterMode: yup
          .mixed<'all' | 'select'>()
          .oneOf(['all', 'select'])
          .required(),
        selectedToolKeys: yup.array().of(yup.string().required()).defined()
      })
  });
  formRef.current = form;

  let resetConfigurationState = () => {
    form.setFieldValue('selectedConfigId', '');
    form.setFieldValue('selectedAuthConfigId', '');
    form.setFieldValue('toolFilterMode', 'all');
    form.setFieldValue('selectedToolKeys', []);
    form.setFieldTouched('selectedConfigId', false, false);
    form.setFieldTouched('selectedAuthConfigId', false, false);
    form.setFieldError('selectedConfigId', undefined);
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
              instanceId={instanceId}
              onSelect={(providerId, providerName) => {
                form.setFieldValue('selectedProviderId', providerId);
                form.setFieldValue('selectedProviderName', providerName);
                form.setFieldValue('selectedDeploymentId', '');
                form.setFieldTouched('selectedDeploymentId', false, false);
                form.setFieldError('selectedDeploymentId', undefined);
                resetConfigurationState();
                setCurrentStep(1);
              }}
              onCancel={onCancel}
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
              selectedDeploymentId={form.values.selectedDeploymentId}
              onSelect={deploymentId => {
                form.setFieldValue('selectedDeploymentId', deploymentId);
                form.setFieldTouched('selectedDeploymentId', false, false);
                form.setFieldError('selectedDeploymentId', undefined);
                resetConfigurationState();
              }}
              onBack={() => setCurrentStep(0)}
              onCancel={onCancel}
              onNext={async () => {
                form.setFieldTouched('selectedDeploymentId', true, false);
                await form.validateField('selectedDeploymentId');
                if (!form.values.selectedDeploymentId) return;
                setCurrentStep(2);
              }}
              error={<form.RenderError field="selectedDeploymentId" />}
            />
          )
        },
        {
          title: 'Configure',
          subtitle: 'Set up the provider',
          render: () => (
            <DeploymentConfigureStep
              instanceId={instanceId}
              sessionTemplateId={sessionTemplateId}
              deploymentId={form.values.selectedDeploymentId}
              providerId={form.values.selectedProviderId}
              providerName={form.values.selectedProviderName}
              selectedConfigId={form.values.selectedConfigId}
              setSelectedConfigId={value => {
                form.setFieldValue('selectedConfigId', value);
                form.setFieldTouched('selectedConfigId', false, false);
                form.setFieldError('selectedConfigId', undefined);
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
              configError={<form.RenderError field="selectedConfigId" />}
              authConfigError={<form.RenderError field="selectedAuthConfigId" />}
              mutationError={<createMutation.RenderError />}
              onBack={() => setCurrentStep(1)}
              onCancel={onCancel}
              onSave={form.submitForm}
            />
          )
        }
      ]}
    />
  );
};

let PickProviderStep = ({
  instanceId,
  onSelect,
  onCancel
}: {
  instanceId: string;
  onSelect: (providerId: string, providerName: string) => void;
  onCancel: () => void;
}) => {
  return (
    <Flex direction="column" gap={12}>
      <ProvidersWithDeploymentsSearch
        instanceId={instanceId}
        onSelect={provider =>
          onSelect(provider.id, provider.name ?? provider.slug ?? 'Provider')
        }
      />

      <Spacer size={10} />

      <Flex justify="end">
        <Button onClick={onCancel} variant="outline">
          Close
        </Button>
      </Flex>
    </Flex>
  );
};

let PickDeploymentStep = ({
  instanceId,
  providerId,
  providerName,
  selectedDeploymentId,
  onSelect,
  onBack,
  onCancel,
  onNext,
  error
}: {
  instanceId: string;
  providerId: string;
  providerName: string;
  selectedDeploymentId: string;
  onSelect: (id: string) => void;
  onBack: () => void;
  onCancel: () => void;
  onNext: () => void;
  error: ReactNode;
}) => {
  let deployments = useProviderDeployments(instanceId, { providerId });
  let items = (deployments.data?.items ?? []) as Deployment[];
  let singleDeploymentId = items.length === 1 ? items[0]?.id : null;

  useEffect(() => {
    if (singleDeploymentId && !selectedDeploymentId) {
      onSelect(singleDeploymentId);
    }
  }, [onSelect, selectedDeploymentId, singleDeploymentId]);

  if (deployments.isLoading) return <CenteredSpinner />;

  if (items.length === 0) {
    return (
      <Flex direction="column" gap={12}>
        <Text size="2" color="gray600">
          No deployments found for <strong>{providerName}</strong>. Create a deployment first.
        </Text>
        <Dialog.Actions>
          <Button variant="outline" onClick={onBack}>
            Back
          </Button>
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        </Dialog.Actions>
      </Flex>
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
        selectedDeploymentId={selectedDeploymentId}
        emptyText={`No deployments found for ${providerName}. Create a deployment first.`}
        onDeploymentClick={deployment => onSelect(deployment.id)}
      />

      <Dialog.Actions>
        <Button variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button disabled={!selectedDeploymentId} onClick={onNext}>
          Next
        </Button>
      </Dialog.Actions>
      {error}
    </Flex>
  );
};

let DeploymentConfigureStep = ({
  instanceId,
  sessionTemplateId,
  deploymentId,
  providerId,
  providerName,
  selectedConfigId,
  setSelectedConfigId,
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
  onBack,
  onCancel,
  onSave
}: {
  instanceId: string;
  sessionTemplateId: string;
  deploymentId: string;
  providerId: string;
  providerName: string;
  selectedConfigId: string;
  setSelectedConfigId: (v: string) => void;
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
  onBack: () => void;
  onCancel: () => void;
  onSave: () => void;
}) => {
  let configs = useProviderConfigs(instanceId, deploymentId);
  let authConfigs = useProviderAuthConfigs(instanceId, deploymentId);
  let deployment = useProviderDeployment(instanceId, deploymentId);
  let provider = useProvider(instanceId, providerId);
  let providerVersionId =
    deployment.data?.lockedVersion?.id ?? provider.data?.currentVersion?.id ?? null;
  let tools = useProviderTools(instanceId, providerVersionId);
  let [fallbackConfigItems, setFallbackConfigItems] = useState<
    Array<{ id: string; name: string | null }>
  >([]);
  let [isLoadingFallbackConfigs, setIsLoadingFallbackConfigs] = useState(false);
  let [fallbackAuthConfigItems, setFallbackAuthConfigItems] = useState<
    Array<{ id: string; name: string | null }>
  >([]);
  let [isLoadingFallbackAuthConfigs, setIsLoadingFallbackAuthConfigs] = useState(false);

  let scopedConfigItems = (configs.data?.items ?? []) as Array<{ id: string; name: string | null }>;
  let configItems = scopedConfigItems.length > 0 ? scopedConfigItems : fallbackConfigItems;
  let scopedAuthConfigItems = (authConfigs.data?.items ?? []) as Array<{
    id: string;
    name: string | null;
  }>;
  let authConfigItems = scopedAuthConfigItems.length > 0 ? scopedAuthConfigItems : fallbackAuthConfigItems;
  let toolItems = (tools.data?.items ?? []) as Array<{
    id: string;
    name: string;
    title?: string | null;
    key?: string;
  }>;
  let shouldLoadFallbackConfigs = !configs.isLoading && scopedConfigItems.length === 0;
  let shouldLoadFallbackAuthConfigs = !authConfigs.isLoading && scopedAuthConfigItems.length === 0;

  useEffect(() => {
    if (!instanceId || !providerId || !shouldLoadFallbackConfigs) {
      setFallbackConfigItems([]);
      setIsLoadingFallbackConfigs(false);
      return;
    }

    let isCanceled = false;
    setIsLoadingFallbackConfigs(true);

    withAuth(sdk => {
      let query: DashboardInstanceProviderDeploymentsConfigsListQuery = {
        providerId,
        status: ['active']
      };
      return sdk.providerDeployments.configs.list(instanceId, query);
    })
      .then(response => {
        if (isCanceled) return;
        setFallbackConfigItems(
          ((response.items ?? []) as Array<{ id: string; name: string | null }>).map(item => ({
            id: item.id,
            name: item.name ?? null
          }))
        );
      })
      .catch(() => {
        if (isCanceled) return;
        setFallbackConfigItems([]);
      })
      .finally(() => {
        if (isCanceled) return;
        setIsLoadingFallbackConfigs(false);
      });

    return () => {
      isCanceled = true;
    };
  }, [instanceId, providerId, shouldLoadFallbackConfigs]);

  useEffect(() => {
    if (!instanceId || !providerId || !shouldLoadFallbackAuthConfigs) {
      setFallbackAuthConfigItems([]);
      setIsLoadingFallbackAuthConfigs(false);
      return;
    }

    let isCanceled = false;
    setIsLoadingFallbackAuthConfigs(true);

    withAuth(sdk =>
      sdk.providerDeployments.authConfigs.list(instanceId, {
        providerId,
        order: 'desc'
      })
    )
      .then(response => {
        if (isCanceled) return;
        setFallbackAuthConfigItems(
          ((response.items ?? []) as Array<{ id: string; name: string | null }>).map(item => ({
            id: item.id,
            name: item.name ?? null
          }))
        );
      })
      .catch(() => {
        if (isCanceled) return;
        setFallbackAuthConfigItems([]);
      })
      .finally(() => {
        if (isCanceled) return;
        setIsLoadingFallbackAuthConfigs(false);
      });

    return () => {
      isCanceled = true;
    };
  }, [instanceId, providerId, shouldLoadFallbackAuthConfigs]);

  useEffect(() => {
    if (configs.isLoading || isLoadingFallbackConfigs || !selectedConfigId) return;
    if (!configItems.some(item => item.id === selectedConfigId)) {
      setSelectedConfigId('');
    }
  }, [
    configs.isLoading,
    isLoadingFallbackConfigs,
    configItems,
    selectedConfigId,
    setSelectedConfigId
  ]);

  useEffect(() => {
    if (configs.isLoading || isLoadingFallbackConfigs || selectedConfigId) return;
    if (scopedConfigItems.length > 0) return;
    if (fallbackConfigItems.length > 0) {
      setSelectedConfigId(fallbackConfigItems[0].id);
    }
  }, [
    configs.isLoading,
    isLoadingFallbackConfigs,
    scopedConfigItems,
    fallbackConfigItems,
    selectedConfigId,
    setSelectedConfigId
  ]);

  useEffect(() => {
    if (authConfigs.isLoading || isLoadingFallbackAuthConfigs || !selectedAuthConfigId) return;
    if (!authConfigItems.some(item => item.id === selectedAuthConfigId)) {
      setSelectedAuthConfigId('');
    }
  }, [
    authConfigs.isLoading,
    isLoadingFallbackAuthConfigs,
    authConfigItems,
    selectedAuthConfigId,
    setSelectedAuthConfigId
  ]);

  if (
    deployment.isLoading ||
    configs.isLoading ||
    isLoadingFallbackConfigs ||
    authConfigs.isLoading ||
    (deployment.data && !deployment.data.lockedVersion?.id && provider.isLoading) ||
    tools.isLoading ||
    isLoadingFallbackAuthConfigs
  ) {
    return <CenteredSpinner />;
  }

  return (
    <Flex direction="column" gap={12}>
      <Text size="2" color="gray600">
        Configure <strong>{providerName}</strong>
      </Text>

      <Select
        label="Config"
        value={selectedConfigId}
        placeholder="None"
        onChange={v => setSelectedConfigId(v)}
        items={configItems.map(c => ({ id: c.id, label: c.name ?? c.id }))}
      />
      {configError}

      <Select
        label="Auth Config"
        value={selectedAuthConfigId}
        placeholder="None"
        onChange={v => setSelectedAuthConfigId(v)}
        items={authConfigItems.map(c => ({ id: c.id, label: c.name ?? c.id }))}
      />
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
                    <Text size="1">{tool.title ?? tool.name}</Text>
                  </label>
                ))}
              </Flex>
            )}
          </Flex>
        </div>
      )}

      {mutationError}

      <Dialog.Actions>
        <Button variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={onSave} loading={saving}>
          Add
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
      <Dialog.Description>
        Choose a provider, select a deployment, and configure it.
      </Dialog.Description>

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

let ProvidersTable = ({
  instanceId,
  sessionTemplateId
}: {
  instanceId: string;
  sessionTemplateId: string;
}) => {
  let providers = useSessionTemplateProviders(instanceId, sessionTemplateId);
  let listings = useProviderListings({});
  let deployments = useProviderDeployments(instanceId);
  let [authConfigNameLookup, setAuthConfigNameLookup] = useState<Record<string, string>>({});

  let listingItems = listings.data?.items ?? [];
  let listingLookup: Record<string, { name: string; imageUrl: string }> = {};
  for (let l of listingItems) {
    let providerId = l.provider?.id;
    if (!providerId) continue;
    listingLookup[providerId] = { name: l.name, imageUrl: l.imageUrl };
  }

  let deploymentItems = (deployments.data?.items ?? []) as Array<{
    id: string;
    name: string | null;
  }>;
  let deploymentLookup: Record<string, string> = {};
  for (let d of deploymentItems) {
    if (d.name) deploymentLookup[d.id] = d.name;
  }
  let items = providers.data?.items ?? [];
  let authConfigLookupKey = items
    .map(item => {
      let authConfigId = item.authConfig?.id ?? null;
      let providerId = item.providerId ?? null;

      return authConfigId && providerId ? `${providerId}:${authConfigId}` : null;
    })
    .filter((v): v is string => !!v)
    .sort()
    .join('|');

  useEffect(() => {
    let rowsNeedingLookup = items.filter(item => {
      let authConfigId = item.authConfig?.id ?? null;
      let providerId = item.providerId ?? null;

      return !!providerId && !!authConfigId;
    });

    if (!instanceId || rowsNeedingLookup.length === 0) {
      setAuthConfigNameLookup(prev => (Object.keys(prev).length === 0 ? prev : {}));
      return;
    }

    let cancelled = false;
    let providerIds = Array.from(
      new Set(
        rowsNeedingLookup
          .map(item => item.providerId ?? null)
          .filter((v): v is string => !!v)
      )
    );

    (async () => {
      try {
        let result = await withAuth(sdk =>
          sdk.providerDeployments.authConfigs.list(instanceId, { providerId: providerIds })
        );

        if (cancelled) return;

        let nextLookup: Record<string, string> = {};
        for (let item of result.items ?? []) {
          nextLookup[item.id] =
            item.name ?? (item.isDefault ? 'Default Auth Config' : 'Unnamed Auth Config');
        }

        setAuthConfigNameLookup(nextLookup);
      } catch {
        if (!cancelled) setAuthConfigNameLookup({});
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [instanceId, authConfigLookupKey]);

  if (providers.isLoading) return <CenteredSpinner />;

  if (items.length === 0) {
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
      data={items.map(provider => {
        let providerId = provider.providerId;
        let listing = providerId ? listingLookup[providerId] : undefined;
        let providerName = listing?.name ?? providerId;
        let deploymentId = provider.deployment.id;
        let deploymentName =
          provider.deployment.name ??
          (deploymentId
            ? (deploymentLookup[deploymentId] ?? null)
            : null);
        let configName = provider.config.name ?? null;
        let configId = provider.config.id;
        let authConfigId = provider.authConfig?.id ?? null;
        let authConfigLabel = authConfigId ? (authConfigNameLookup[authConfigId] ?? null) : null;

        return {
          data: [
            <Flex gap={10} style={{ alignItems: 'center' }}>
              <Avatar
                entity={{ name: providerName, photoUrl: listing?.imageUrl }}
                size={24}
                radius={6}
                noTooltip
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
};

export let SessionTemplateProvidersPage = () => {
  let instance = useCurrentInstance();
  let { sessionTemplateId } = useParams();
  let template = useSessionTemplate(instance.data?.id, sessionTemplateId);

  return renderWithLoader({ template })(({ template }) => (
    <>
      <Spacer size={16} />

      <ProvidersTable
        instanceId={instance.data!.id}
        sessionTemplateId={sessionTemplateId!}
      />
    </>
  ));
};
