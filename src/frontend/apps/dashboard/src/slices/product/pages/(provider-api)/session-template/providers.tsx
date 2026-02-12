import { renderWithLoader } from '@metorial/data-hooks';
import {
  useCurrentInstance,
  useProviderAuthConfigs,
  useProviderConfigs,
  useProviderDeployments,
  useProviderTools,
  useSessionTemplate,
  useProviderListings,
  withAuth
} from '@metorial/state';
import {
  Badge,
  Button,
  CenteredSpinner,
  Dialog,
  Flex,
  Or,
  Select,
  showModal,
  Spacer,
  Text,
  theme
} from '@metorial/ui';
import { ID } from '@metorial/ui-product';
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Stepper } from '../../../scenes/stepper';

// ── Add Provider Modal ───────────────────────────────────────────────

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

  // Config step state
  let [selectedConfigId, setSelectedConfigId] = useState('');
  let [selectedAuthConfigId, setSelectedAuthConfigId] = useState('');
  let [toolFilterMode, setToolFilterMode] = useState<'all' | 'select'>('all');
  let [selectedToolKeys, setSelectedToolKeys] = useState<string[]>([]);

  let handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await withAuth(sdk =>
        sdk.sessionTemplates.providers.create(instanceId, sessionTemplateId, {
          providerDeployment: {
            type: 'reference' as const,
            providerDeploymentId: selectedDeploymentId
          },
          ...(selectedConfigId
            ? {
                providerConfig: {
                  type: 'reference' as const,
                  providerConfigId: selectedConfigId
                }
              }
            : {}),
          ...(selectedAuthConfigId
            ? {
                providerAuthConfig: {
                  type: 'reference' as const,
                  providerAuthConfigId: selectedAuthConfigId
                }
              }
            : {}),
          ...(toolFilterMode === 'select' && selectedToolKeys.length > 0
            ? { toolFilters: { toolKeys: selectedToolKeys } }
            : {})
        })
      );
      onComplete();
    } catch (e: unknown) {
      let message =
        (e as { data?: { message?: string } })?.data?.message ||
        (e as { message?: string })?.message ||
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
              onSelect={setSelectedDeploymentId}
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
  let listings = useProviderListings({ instanceId, orderByRank: true });
  let [search, setSearch] = useState('');

  if (deployments.isLoading) return <CenteredSpinner />;

  let items = (deployments.data?.items ?? []) as Deployment[];

  // Build provider info lookup from listings
  let listingItems = (listings.data?.items ?? []) as Array<{
    providerId: string;
    name: string;
    imageUrl: string | null;
  }>;
  let listingLookup: Record<string, { name: string; imageUrl: string | null }> = {};
  for (let l of listingItems) {
    if (l.providerId) listingLookup[l.providerId] = { name: l.name, imageUrl: l.imageUrl };
  }

  // Deduplicate by provider
  let providers: Record<
    string,
    { name: string; imageUrl: string | null; deploymentCount: number }
  > = {};
  for (let d of items) {
    if (!providers[d.providerId]) {
      let info = listingLookup[d.providerId];
      providers[d.providerId] = {
        name: d.provider?.name ?? info?.name ?? d.providerId,
        imageUrl: info?.imageUrl ?? d.provider?.imageUrl ?? null,
        deploymentCount: 0
      };
    }
    providers[d.providerId].deploymentCount++;
  }

  let providerList = Object.entries(providers);

  // Filter by search
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
            {provider.imageUrl ? (
              <img
                src={provider.imageUrl}
                alt={provider.name}
                style={{ width: 28, height: 28, borderRadius: 6, flexShrink: 0 }}
              />
            ) : (
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 6,
                  background: theme.colors.gray200,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 13,
                  fontWeight: 600,
                  color: theme.colors.gray600,
                  flexShrink: 0
                }}
              >
                {provider.name.charAt(0).toUpperCase()}
              </div>
            )}
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

  if (deployments.isLoading) return <CenteredSpinner />;

  let items = (deployments.data?.items ?? []) as Deployment[];

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

  // Auto-select if only one
  if (items.length === 1 && !selectedDeploymentId) {
    onSelect(items[0].id);
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
  let tools = useProviderTools(instanceId, providerId);

  let configItems = (configs.data?.items ?? []) as Array<{ id: string; name: string | null }>;
  let authConfigItems = (authConfigs.data?.items ?? []) as Array<{
    id: string;
    name: string | null;
  }>;
  let toolItems = (tools.data?.items ?? []) as Array<{
    id: string;
    name: string;
    key?: string;
  }>;

  if (configs.isLoading || authConfigs.isLoading || tools.isLoading) {
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
                    <Text size="1">{tool.name}</Text>
                  </label>
                ))}
              </Flex>
            )}
          </Flex>
        </div>
      )}

      {error && (
        <Text size="2" color="red">
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

let showAddProviderModal = (p: {
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

// ── Providers Page ───────────────────────────────────────────────────

export let SessionTemplateProvidersPage = () => {
  let instance = useCurrentInstance();
  let { sessionTemplateId } = useParams();
  let template = useSessionTemplate(instance.data?.instanceId, sessionTemplateId);

  return renderWithLoader({ template })(({ template }) => {
    let providers = template.data.providers ?? [];

    return (
      <>
        <Spacer size={10} />

        <Button
          size="2"
          onClick={() => {
            if (!instance.data) return;
            showAddProviderModal({
              instanceId: instance.data.instanceId,
              sessionTemplateId: sessionTemplateId!,
              onComplete: () => template.refetch?.()
            });
          }}
        >
          Add Provider
        </Button>

        <Spacer size={15} />

        {providers.length === 0 && (
          <Text size="2" color="gray600" align="center" style={{ marginTop: 10 }}>
            No providers configured. Add one to get started.
          </Text>
        )}

        <Flex direction="column" gap={8}>
          {providers.map(
            (p: {
              id: string;
              provider?: { name: string } | null;
              providerId: string;
              providerDeployment?: { name: string } | null;
              providerDeploymentId: string;
              providerConfig?: { name: string } | null;
              providerConfigId?: string | null;
              providerAuthConfig?: { name: string } | null;
              providerAuthConfigId?: string | null;
            }) => (
              <div
                key={p.id}
                style={{
                  border: `1px solid ${theme.colors.gray300}`,
                  borderRadius: 8,
                  padding: '14px 16px'
                }}
              >
                <Flex style={{ alignItems: 'center', justifyContent: 'space-between' }}>
                  <Flex gap={8} style={{ alignItems: 'center' }}>
                    <Text size="2" weight="strong">
                      {p.provider?.name ?? p.providerId}
                    </Text>
                    <Badge color="gray" size="1">
                      {p.providerDeployment?.name ?? p.providerDeploymentId}
                    </Badge>
                  </Flex>

                  <ID id={p.id} />
                </Flex>

                <Flex gap={16} style={{ marginTop: 6 }}>
                  <Text size="1" color="gray600">
                    Config: {p.providerConfig?.name ?? p.providerConfigId ?? 'None'}
                  </Text>
                  <Text size="1" color="gray600">
                    Auth: {p.providerAuthConfig?.name ?? p.providerAuthConfigId ?? 'None'}
                  </Text>
                </Flex>
              </div>
            )
          )}
        </Flex>
      </>
    );
  });
};
