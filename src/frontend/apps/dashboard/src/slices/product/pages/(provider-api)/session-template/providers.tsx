import {
  DashboardInstanceProviderDeploymentsAuthConfigsListOutput,
  DashboardInstanceProviderDeploymentsConfigsListQuery,
  DashboardInstanceSessionTemplatesProvidersListOutput
} from '@metorial/dashboard-sdk';
import { renderWithLoader } from '@metorial/data-hooks';
import {
  useCurrentInstance,
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
  Or,
  RenderDate,
  Select,
  showModal,
  Spacer,
  Text,
  theme
} from '@metorial/ui';
import { Table } from '@metorial/ui-product';
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
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
  let [selectedProviderId, setSelectedProviderId] = useState('');
  let [selectedProviderName, setSelectedProviderName] = useState('');
  let [selectedDeploymentId, setSelectedDeploymentId] = useState('');
  let [saving, setSaving] = useState(false);
  let [error, setError] = useState<string | null>(null);

  let [selectedConfigId, setSelectedConfigId] = useState('');
  let [selectedAuthConfigId, setSelectedAuthConfigId] = useState('');
  let [toolFilterMode, setToolFilterMode] = useState<'all' | 'select'>('all');
  let [selectedToolKeys, setSelectedToolKeys] = useState<string[]>([]);

  let resetConfigurationState = () => {
    setSelectedConfigId('');
    setSelectedAuthConfigId('');
    setToolFilterMode('all');
    setSelectedToolKeys([]);
    setError(null);
  };

  let handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await withAuth(sdk =>
        sdk.sessionTemplates.providers.create(instanceId, {
          sessionTemplateId,
          providerDeploymentId: selectedDeploymentId,
          ...(selectedConfigId
            ? {
                providerConfigId: selectedConfigId
              }
            : {}),
          ...(selectedAuthConfigId
            ? {
                providerAuthConfigId: selectedAuthConfigId
              }
            : {}),
          ...(toolFilterMode === 'select' && selectedToolKeys.length > 0
            ? { toolFilters: { toolKeys: selectedToolKeys } }
            : {})
        })
      );
      onComplete();
    } catch (e: unknown) {
      let sdkError = e as {
        response?: { code?: string; entityId?: string; message?: string };
        data?: { code?: string; entityId?: string; message?: string };
        message?: string;
      };
      let errorCode = sdkError.response?.code ?? sdkError.data?.code;
      let entityId = sdkError.response?.entityId ?? sdkError.data?.entityId;

      if (errorCode === 'use_after_delete' && entityId) {
        if (entityId === selectedConfigId) {
          setSelectedConfigId('');
        }
        if (entityId === selectedAuthConfigId) {
          setSelectedAuthConfigId('');
        }
      }

      let message =
        errorCode === 'use_after_delete' && entityId === selectedConfigId
          ? 'Selected provider config was deleted or archived. Choose another config or leave Config empty.'
          : errorCode === 'use_after_delete' && entityId === selectedAuthConfigId
            ? 'Selected auth config was deleted or archived. Choose another auth config or leave Auth Config empty.'
            : sdkError.data?.message ||
              sdkError.response?.message ||
              sdkError.message ||
              'Failed to add provider.';
      setError(message);
    } finally {
      setSaving(false);
    }
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
                setSelectedProviderId(providerId);
                setSelectedProviderName(providerName);
                setSelectedDeploymentId('');
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
              providerId={selectedProviderId}
              providerName={selectedProviderName}
              selectedDeploymentId={selectedDeploymentId}
              onSelect={deploymentId => {
                setSelectedDeploymentId(deploymentId);
                resetConfigurationState();
              }}
              onBack={() => setCurrentStep(0)}
              onCancel={onCancel}
              onNext={() => setCurrentStep(2)}
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
              deploymentId={selectedDeploymentId}
              providerId={selectedProviderId}
              providerName={selectedProviderName}
              selectedConfigId={selectedConfigId}
              setSelectedConfigId={setSelectedConfigId}
              selectedAuthConfigId={selectedAuthConfigId}
              setSelectedAuthConfigId={setSelectedAuthConfigId}
              toolFilterMode={toolFilterMode}
              setToolFilterMode={setToolFilterMode}
              selectedToolKeys={selectedToolKeys}
              setSelectedToolKeys={setSelectedToolKeys}
              saving={saving}
              error={error}
              onBack={() => setCurrentStep(1)}
              onCancel={onCancel}
              onSave={handleSave}
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
  let deployments = useProviderDeployments(instanceId);
  let listings = useProviderListings({});
  let [search, setSearch] = useState('');

  if (deployments.isLoading) return <CenteredSpinner />;

  let items = (deployments.data?.items ?? []) as Deployment[];

  let listingItems = listings.data?.items ?? [];
  let listingLookup: Record<string, { name: string; imageUrl: string }> = {};
  for (let l of listingItems) {
    let providerId = l.provider?.id;
    if (!providerId) continue;
    listingLookup[providerId] = { name: l.name, imageUrl: l.imageUrl };
  }

  let providers: Record<
    string,
    { name: string; imageUrl: string; deploymentCount: number }
  > = {};
  for (let d of items) {
    if (!providers[d.providerId]) {
      let info = listingLookup[d.providerId];
      providers[d.providerId] = {
        name: d.provider?.name ?? info?.name ?? d.providerId,
        imageUrl: info?.imageUrl ?? d.provider?.imageUrl ?? '',
        deploymentCount: 0
      };
    }
    providers[d.providerId].deploymentCount++;
  }

  let providerList = Object.entries(providers);

  let needle = search.toLowerCase().trim();
  if (needle) {
    providerList = providerList.filter(([, p]) => p.name.toLowerCase().includes(needle));
  }

  if (Object.keys(providers).length === 0) {
    return (
      <Flex direction="column" gap={12}>
        <Text size="2" color="gray600">
          No providers with deployments found. Create a deployment first.
        </Text>
        <Dialog.Actions>
          <Button variant="outline" onClick={onCancel}>
            Close
          </Button>
        </Dialog.Actions>
      </Flex>
    );
  }

  return (
    <Flex direction="column" gap={12}>
      <input
        type="text"
        placeholder="Search providers..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        style={{
          padding: '10px 14px',
          border: 'none',
          borderRadius: 8,
          fontSize: 14,
          outline: 'none',
          width: '100%',
          boxSizing: 'border-box',
          background: theme.colors.gray200
        }}
      />

      <Or text="Providers" />

      <Spacer size={4} />

      <div
        style={{
          maxHeight: 350,
          overflow: 'auto',
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 8
        }}
      >
        {providerList.map(([providerId, provider]) => (
          <button
            key={providerId}
            type="button"
            onClick={() => onSelect(providerId, provider.name)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '10px 12px',
              border: `1px solid ${theme.colors.gray300}`,
              borderRadius: 8,
              background: 'white',
              cursor: 'pointer',
              textAlign: 'left'
            }}
          >
            <Avatar
              entity={{ name: provider.name, photoUrl: provider.imageUrl }}
              size={28}
              radius={6}
              noTooltip
            />
            <Text size="2">{provider.name}</Text>
          </button>
        ))}
      </div>

      {providerList.length === 0 && needle && (
        <Text size="2" color="gray600" align="center" style={{ padding: 12 }}>
          No providers match "{search}"
        </Text>
      )}
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
  onNext
}: {
  instanceId: string;
  providerId: string;
  providerName: string;
  selectedDeploymentId: string;
  onSelect: (id: string) => void;
  onBack: () => void;
  onCancel: () => void;
  onNext: () => void;
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

      <Flex direction="column" gap={6}>
        {items.map(
          (
            d: Deployment & {
              description?: string | null;
              lockedVersion?: { version: string; status: string } | null;
              createdAt?: Date;
              status?: string;
            }
          ) => {
            let isSelected = selectedDeploymentId === d.id;

            return (
              <label
                key={d.id}
                style={{
                  display: 'flex',
                  gap: 12,
                  padding: '12px 14px',
                  cursor: 'pointer',
                  border: `1px solid ${isSelected ? '#3b82f6' : theme.colors.gray300}`,
                  borderRadius: 8,
                  background: isSelected ? 'rgba(59, 130, 246, 0.04)' : undefined
                }}
              >
                <input
                  type="radio"
                  name="deployment"
                  checked={isSelected}
                  onChange={() => onSelect(d.id)}
                  style={{ accentColor: '#3b82f6', marginTop: 2 }}
                />

                <Flex direction="column" gap={2} style={{ flex: 1 }}>
                  <Flex gap={8} style={{ alignItems: 'center' }}>
                    <Text size="2" weight="strong">
                      {d.name ?? 'Unnamed deployment'}
                    </Text>
                    {d.status && (
                      <Badge color={d.status === 'active' ? 'green' : 'gray'} size="1">
                        {d.status}
                      </Badge>
                    )}
                  </Flex>

                  {d.description && (
                    <Text size="1" color="gray600">
                      {d.description.length > 80
                        ? d.description.slice(0, 80) + '…'
                        : d.description}
                    </Text>
                  )}

                  <Flex gap={10} style={{ marginTop: 2 }}>
                    {d.lockedVersion && (
                      <Text size="1" color="gray600">
                        Version:{' '}
                        <span style={{ fontFamily: 'monospace' }}>
                          {d.lockedVersion.version}
                        </span>
                      </Text>
                    )}
                    <Text size="1" color="gray600" style={{ fontFamily: 'monospace' }}>
                      {d.id.slice(0, 20)}…
                    </Text>
                  </Flex>
                </Flex>
              </label>
            );
          }
        )}
      </Flex>

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
  error,
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
  error: string | null;
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
        providerId
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

      <Select
        label="Auth Config"
        value={selectedAuthConfigId}
        placeholder="None"
        onChange={v => setSelectedAuthConfigId(v)}
        items={authConfigItems.map(c => ({ id: c.id, label: c.name ?? c.id }))}
      />

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

      {error && (
        <Text size="2" color="red500">
          {error}
        </Text>
      )}

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
        let results = await Promise.all(
          providerIds.map(providerId =>
            withAuth(sdk =>
              sdk.providerDeployments.authConfigs.list(instanceId, { providerId })
            ).catch(() => null)
          )
        );

        if (cancelled) return;

        let nextLookup: Record<string, string> = {};
        for (let result of results) {
          let authConfigItems: DashboardInstanceProviderDeploymentsAuthConfigsListOutput['items'] =
            result?.items ?? [];

          for (let item of authConfigItems) {
            nextLookup[item.id] =
              item.name ?? (item.isDefault ? 'Default Auth Config' : 'Unnamed Auth Config');
          }
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
