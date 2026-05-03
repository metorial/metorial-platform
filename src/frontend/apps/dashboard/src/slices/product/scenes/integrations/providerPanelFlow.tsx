import { useForm } from '@metorial/data-hooks';
import {
  IntegrationInstance,
  IntegrationInstanceProvider,
  IntegrationPreview,
  IntegrationProvider,
  useCreateIntegrationProvider,
  useCreateProviderConfig,
  useCreateProviderDeployment,
  useCurrentInstance,
  useProvider,
  useProviderAuthCredentials,
  useProviderAuthMethods,
  useProviderConfigSchemaTarget,
  useProviderListing,
  useSetIntegrationInstanceProvider,
  useUpdateIntegrationProvider
} from '@metorial/state';
import {
  Avatar,
  Badge,
  Button,
  CenteredSpinner,
  Dialog,
  Entity,
  Flex,
  Select,
  Text,
  theme
} from '@metorial/ui';
import { RiAddLine, RiCheckLine } from '@remixicon/react';
import { AnimatePresence, motion } from 'framer-motion';
import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import {
  type ConfigurationSelection,
  emptyConfigurationSelection
} from '../../lib/configSelection';
import { getProviderConfigSchemaCapabilities } from '../../lib/providerCreationCapabilities';
import { AuthMethodPicker } from '../providerAuthConfigs/authMethodPicker';
import { showProviderAuthCredentialsFormModal } from '../providerAuthCredentials/modal';
import {
  ProviderCreationPanelShell,
  ProviderSelectionStep,
  showProviderCreationPanel
} from '../providerCreationPanel';
import { FlatCreateSection } from '../providerCreationPanel/flatCreateLayout';
import { ProviderSetupSections } from '../sessionTemplates/addProviderPanelFlow';

type ToolFilterFormValues = {
  toolFilterMode: 'all' | 'select';
  selectedToolKeys: string[];
};

type IntegrationProviderFormValues = ToolFilterFormValues & {
  selectedProviderId: string;
  selectedConfiguration: ConfigurationSelection;
  selectedAuthMethodId: string;
  selectedAuthCredentialsId: string;
};

type IntegrationInstanceProviderFormValues = ToolFilterFormValues & {
  selectedProviderId: string;
  selectedConfiguration: ConfigurationSelection;
  selectedAuthConfigId: string;
};

let getProviderName = (provider: any, fallback?: string) =>
  provider?.name ?? provider?.slug ?? fallback ?? 'Provider';

let getToolFilters = (values: ToolFilterFormValues) =>
  values.toolFilterMode === 'select'
    ? {
        type: 'tool_keys' as const,
        keys: values.selectedToolKeys
      }
    : undefined;

let useProviderSetupVisibility = (p: {
  instanceId: string | null | undefined;
  providerId: string | null | undefined;
  integration: IntegrationPreview | null | undefined;
  existingConfigId?: string | null;
  allowAuthConfig?: boolean;
  respectIntegrationCustomConfigPolicy?: boolean;
  isUpdate?: boolean;
}) => {
  let provider = useProvider(p.instanceId, p.providerId);
  let providerSupportsConfig = provider.data?.type.config.status === 'enabled';
  let configSchema = useProviderConfigSchemaTarget(
    p.instanceId,
    p.providerId && providerSupportsConfig ? { providerId: p.providerId } : null
  );
  let configCapabilities = getProviderConfigSchemaCapabilities({
    schemaValue: configSchema.data?.schema,
    hasVaults: false,
    isLoading: providerSupportsConfig ? configSchema.isLoading : false
  });
  let allowCustomConfigs =
    p.respectIntegrationCustomConfigPolicy === false
      ? true
      : (p.integration?.configuration?.canAttachCustomProviderConfig ?? true);
  let allowToolFilters = p.integration?.configuration?.canOverrideToolFilters ?? true;
  let providerSupportsAuth = provider.data?.type.auth.status === 'enabled';
  let hasConfigInputs = configCapabilities.hasSchemaFields;
  // Auto-creating an empty config silently is only desirable on initial
  // creation. In update flows, the user opened the panel deliberately and
  // should be given a chance to set/clear a config explicitly.
  let shouldAutoCreateEmptyConfig =
    !p.isUpdate &&
    allowCustomConfigs &&
    providerSupportsConfig &&
    !p.existingConfigId &&
    !hasConfigInputs &&
    !configCapabilities.isLoading;
  // In update mode the user explicitly opened the panel to make changes -- we
  // surface the config picker even for providers whose config support isn't
  // strictly "enabled" (e.g. providers that only ever take an empty config),
  // because the API still accepts a configId for them.
  let showConfig = p.isUpdate
    ? allowCustomConfigs
    : allowCustomConfigs && providerSupportsConfig && !shouldAutoCreateEmptyConfig;

  return {
    provider,
    isLoading: provider.isLoading || configCapabilities.isLoading,
    showConfig,
    showAuth: (p.allowAuthConfig ?? true) && providerSupportsAuth,
    showToolFilters: allowToolFilters,
    shouldAutoCreateEmptyConfig,
    providerName: getProviderName(provider.data, p.providerId ?? undefined)
  };
};

let ConfigureSectionCard = (p: {
  title: string;
  description: string;
  requirement: 'required' | 'optional';
  completed?: boolean;
  children: ReactNode;
}) => {
  let state = p.completed ? 'completed' : p.requirement;

  return (
    <FlatCreateSection style={{ padding: 0, gap: 0, overflow: 'hidden' }}>
      <Flex
        direction="column"
        gap={10}
        style={{
          padding: '16px 16px 12px',
          borderBottom: '1px solid rgba(17, 17, 17, 0.08)'
        }}
      >
        <Flex direction="column" gap={6} style={{ flex: 1, minWidth: 240 }}>
          <Flex align="center" gap={10} wrap="wrap">
            <motion.div
              initial={false}
              animate={{
                backgroundColor:
                  state === 'completed'
                    ? theme.colors.primary300
                    : 'rgba(255, 255, 255, 0.96)',
                borderColor:
                  state === 'completed'
                    ? theme.colors.primary300
                    : state === 'required'
                      ? 'rgba(17, 17, 17, 0.14)'
                      : 'rgba(17, 17, 17, 0.18)',
                scale: state === 'completed' ? 1.02 : 1,
                boxShadow:
                  state === 'completed'
                    ? `0 0 0 4px ${theme.colors.blue300}`
                    : '0 1px 2px rgba(17, 17, 17, 0.05)'
              }}
              transition={{ type: 'spring', stiffness: 260, damping: 22 }}
              style={{
                width: 22,
                height: 22,
                minWidth: 22,
                borderRadius: 999,
                borderWidth: 1.5,
                borderStyle: state === 'optional' ? 'dashed' : 'solid',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <AnimatePresence mode="wait" initial={false}>
                {state === 'completed' ? (
                  <motion.span
                    key="completed"
                    initial={{ opacity: 0, scale: 0.65, rotate: -12 }}
                    animate={{ opacity: 1, scale: 1, rotate: 0 }}
                    exit={{ opacity: 0, scale: 0.65, rotate: 12 }}
                    transition={{ duration: 0.18, ease: 'easeOut' }}
                    style={{ display: 'inline-flex', color: '#fff' }}
                  >
                    <RiCheckLine size={13} />
                  </motion.span>
                ) : (
                  <motion.span
                    key={state}
                    initial={{ opacity: 0, scale: 0.75 }}
                    animate={{ opacity: state === 'required' ? 0.7 : 0.35, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.75 }}
                    transition={{ duration: 0.18, ease: 'easeOut' }}
                    style={{
                      width: state === 'required' ? 8 : 6,
                      height: state === 'required' ? 8 : 6,
                      borderRadius: 999,
                      background:
                        state === 'required'
                          ? 'rgba(17, 17, 17, 0.58)'
                          : 'rgba(17, 17, 17, 0.22)'
                    }}
                  />
                )}
              </AnimatePresence>
            </motion.div>

            <Text size="3" weight="strong">
              {p.title}
            </Text>

            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={state}
                initial={{ opacity: 0, y: -4, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 4, scale: 0.96 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
                style={{ display: 'inline-flex' }}
              >
                <Badge
                  color={
                    state === 'completed'
                      ? 'blue'
                      : p.requirement === 'required'
                        ? 'orange'
                        : 'gray'
                  }
                  size="1"
                >
                  {state === 'completed'
                    ? 'Completed'
                    : p.requirement === 'required'
                      ? 'Required'
                      : 'Optional'}
                </Badge>
              </motion.div>
            </AnimatePresence>
          </Flex>
          <Text size="2" color="gray700">
            {p.description}
          </Text>
        </Flex>
      </Flex>

      <div style={{ padding: 16 }}>{p.children}</div>
    </FlatCreateSection>
  );
};

let IntegrationProviderSummaryCard = (p: {
  instanceId: string;
  providerId: string;
  providerName: string;
}) => {
  let providerListing = useProviderListing(p.instanceId, p.providerId);
  let providerDisplayName =
    providerListing.data?.name ??
    p.providerName ??
    providerListing.data?.provider.slug ??
    'Provider';
  let providerImageUrl = providerListing.data?.imageUrl;

  return (
    <Entity.Wrapper>
      <Entity.Content>
        <Entity.Field
          title={providerDisplayName}
          prefix={
            <Avatar
              entity={{
                name: providerDisplayName,
                photoUrl: providerImageUrl ?? undefined
              }}
              size={32}
              radius={8}
              noTooltip
              imageFit="contain"
            />
          }
        />
      </Entity.Content>
    </Entity.Wrapper>
  );
};

let IntegrationProviderAuthSection = (p: {
  instanceId: string;
  providerId: string;
  authMethods: {
    data?: {
      items: {
        id: string;
        name: string;
        description?: string | null;
        type: 'oauth' | 'token' | 'custom';
      }[];
    } | null;
    isLoading: boolean;
  };
  selectedAuthMethod:
    | {
        id: string;
        type: 'oauth' | 'token' | 'custom';
      }
    | undefined;
  authCredentials: {
    data?: {
      items: {
        id: string;
        name: string | null;
        isManaged: boolean;
        isDefault: boolean;
      }[];
    } | null;
    isLoading: boolean;
  };
  selectedAuthMethodId: string;
  onSelectedAuthMethodIdChange: (value: string) => void;
  selectedAuthCredentialsId: string;
  onSelectedAuthCredentialsIdChange: (value: string) => void;
  authMethodError?: React.ReactNode;
  authCredentialsError?: React.ReactNode;
}) => {
  let authMethodItems = p.authMethods.data?.items ?? [];
  let credentialItems = (p.authCredentials.data?.items ?? []).map(credentials => ({
    id: credentials.id,
    label: credentials.name ?? credentials.id
  }));
  let selectedCredentialsLabel =
    credentialItems.find(credentials => credentials.id === p.selectedAuthCredentialsId)
      ?.label ?? p.selectedAuthCredentialsId;

  return (
    <Flex direction="column" gap={12}>
      {p.authMethods.isLoading ? (
        <CenteredSpinner />
      ) : authMethodItems.length > 0 ? (
        <>
          <ConfigureSectionCard
            title="Auth Method"
            description="Choose how this integration provider authenticates with the provider."
            requirement="required"
            completed={Boolean(p.selectedAuthMethodId)}
          >
            <Flex direction="column" gap={10}>
              <AuthMethodPicker
                label="Authentication Method"
                hideLabel
                value={p.selectedAuthMethodId}
                onChange={value => {
                  p.onSelectedAuthMethodIdChange(value);
                }}
                items={authMethodItems.map(method => ({
                  id: method.id,
                  name: method.name,
                  description: method.description
                }))}
              />
              {p.authMethodError}
            </Flex>
          </ConfigureSectionCard>

          <AnimatePresence initial={false}>
            {p.selectedAuthMethod?.type === 'oauth' ? (
              <motion.div
                key="oauth-auth-credentials"
                initial={{ opacity: 0, y: -8, height: 0 }}
                animate={{ opacity: 1, y: 0, height: 'auto' }}
                exit={{ opacity: 0, y: -8, height: 0 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
                style={{ overflow: 'hidden' }}
              >
                <ConfigureSectionCard
                  title="Auth Credentials"
                  description="Select or create the OAuth credentials this integration provider should use."
                  requirement="required"
                  completed={Boolean(p.selectedAuthCredentialsId)}
                >
                  <Flex direction="column" gap={10}>
                    {p.selectedAuthCredentialsId ? (
                      <Flex justify="space-between" align="center" gap={12} wrap="wrap">
                        <Text size="2">
                          Selected auth credentials:{' '}
                          <strong>{selectedCredentialsLabel}</strong>
                        </Text>
                        <Button
                          type="button"
                          size="2"
                          variant="outline"
                          onClick={() => p.onSelectedAuthCredentialsIdChange('')}
                        >
                          Choose another
                        </Button>
                      </Flex>
                    ) : (
                      <Flex gap={8} align="end">
                        <div style={{ flex: 1 }}>
                          <Select
                            label="Auth Credentials"
                            value={p.selectedAuthCredentialsId}
                            placeholder="Select auth credentials"
                            items={credentialItems}
                            onChange={value => {
                              p.onSelectedAuthCredentialsIdChange(value);
                            }}
                            disabled={p.authCredentials.isLoading}
                          />
                        </div>
                        <div>
                          <Button
                            type="button"
                            size="3"
                            iconLeft={<RiAddLine />}
                            onClick={() =>
                              showProviderAuthCredentialsFormModal({
                                instanceId: p.instanceId,
                                providerId: p.providerId,
                                onCreate: credentials => {
                                  p.onSelectedAuthCredentialsIdChange(credentials.id);
                                }
                              })
                            }
                          >
                            Create Auth Credentials
                          </Button>
                        </div>
                      </Flex>
                    )}
                    {p.authCredentialsError}
                  </Flex>
                </ConfigureSectionCard>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </>
      ) : (
        <Text size="2" color="gray600">
          This provider does not currently expose any auth methods.
        </Text>
      )}
    </Flex>
  );
};

let IntegrationProviderSetupStep = (p: {
  integration: IntegrationPreview;
  providerId: string;
  integrationProvider?: IntegrationProvider;
  close: () => void;
  onBack?: () => void;
  onComplete: () => void;
}) => {
  let instance = useCurrentInstance();
  let createDeployment = useCreateProviderDeployment();
  let createConfig = useCreateProviderConfig();
  let createIntegrationProvider = useCreateIntegrationProvider();
  let updateIntegrationProvider = useUpdateIntegrationProvider();
  let autoSubmitAttemptedRef = useRef(false);
  let isUpdate = !!p.integrationProvider;
  let visibility = useProviderSetupVisibility({
    instanceId: instance.data?.id,
    providerId: p.providerId,
    integration: p.integration,
    existingConfigId: p.integrationProvider?.config?.id,
    respectIntegrationCustomConfigPolicy: false,
    isUpdate
  });
  let authMethods = useProviderAuthMethods(
    instance.data?.id,
    visibility.showAuth && visibility.provider.data?.currentVersion?.id
      ? { providerVersionId: visibility.provider.data.currentVersion.id }
      : null
  );
  // In update mode, skip the auth section entirely if the provider exposes no
  // auth methods -- there is nothing the user can pick, so we shouldn't show
  // an empty section. In create mode we keep the existing behavior so the
  // empty-state copy still renders for transparency.
  let effectiveShowAuth =
    visibility.showAuth &&
    (!isUpdate ||
      (!authMethods.isLoading && (authMethods.data?.items.length ?? 0) > 0));

  let submitProviderSetup = async (values: IntegrationProviderFormValues) => {
    if (!instance.data) return false;

    let selectedAuthMethod = authMethods.data?.items.find(
      method => method.id === values.selectedAuthMethodId
    );

    let providerConfigId =
      values.selectedConfiguration.kind === 'config'
        ? values.selectedConfiguration.id
        : undefined;

    if (!providerConfigId && visibility.shouldAutoCreateEmptyConfig) {
      let [config] = await createConfig.mutate({
        instanceId: instance.data.id,
        providerId: p.providerId,
        name: `${visibility.providerName} Config`,
        value: {}
      });
      providerConfigId = config?.id;
    }

    let providerAuthMethodId = values.selectedAuthMethodId || undefined;
    let providerAuthCredentialsId = values.selectedAuthCredentialsId || undefined;

    if (p.integrationProvider) {
      let [updated] = await updateIntegrationProvider.mutate({
        instanceId: instance.data.id,
        integrationProviderId: p.integrationProvider.id,
        providerConfigId: providerConfigId ?? null,
        providerAuthMethodId: providerAuthMethodId ?? null,
        providerAuthCredentialsId: providerAuthCredentialsId ?? null,
        toolFilters: getToolFilters(values)
      });
      if (!updated) return false;
      p.onComplete();
      p.close();
      return true;
    }

    let [deployment] = await createDeployment.mutate({
      instanceId: instance.data.id,
      providerId: p.providerId,
      name: `${visibility.providerName} Integration Deployment`
    });
    if (!deployment) return false;

    let [created] = await createIntegrationProvider.mutate({
      instanceId: instance.data.id,
      integrationId: p.integration.id,
      providerId: p.providerId,
      providerDeploymentId: deployment.id,
      providerConfigId: providerConfigId ?? null,
      providerAuthMethodId,
      providerAuthCredentialsId,
      toolFilters: getToolFilters(values)
    });
    if (!created) return false;
    p.onComplete();
    p.close();
    return true;
  };

  let form = useForm<IntegrationProviderFormValues, IntegrationProviderFormValues>({
    initialValues: {
      selectedProviderId: p.providerId,
      selectedConfiguration: p.integrationProvider?.config?.id
        ? { kind: 'config', id: p.integrationProvider.config.id }
        : emptyConfigurationSelection(),
      selectedAuthMethodId: p.integrationProvider?.authMethod?.id ?? '',
      selectedAuthCredentialsId: p.integrationProvider?.authCredentials?.id ?? '',
      toolFilterMode: p.integrationProvider?.toolFilter?.type === 'filter' ? 'select' : 'all',
      selectedToolKeys:
        p.integrationProvider?.toolFilter?.type === 'filter'
          ? p.integrationProvider.toolFilter.filters.flatMap(filter =>
              filter.type === 'tool_keys' ? filter.keys : []
            )
          : []
    },
    onSubmit: async values => {
      let selectedAuthMethod = authMethods.data?.items.find(
        method => method.id === values.selectedAuthMethodId
      );

      if (effectiveShowAuth) {
        if (!values.selectedAuthMethodId) {
          form.setFieldTouched('selectedAuthMethodId', true, false);
          form.setFieldError('selectedAuthMethodId', 'Select an auth method');
          return;
        }

        if (selectedAuthMethod?.type === 'oauth' && !values.selectedAuthCredentialsId) {
          form.setFieldTouched('selectedAuthCredentialsId', true, false);
          form.setFieldError('selectedAuthCredentialsId', 'Select auth credentials');
          return;
        }
      }
      await submitProviderSetup(values);
    },
    schema: yup =>
      yup.object({
        selectedProviderId: yup.string().required(),
        selectedConfiguration: yup.mixed<ConfigurationSelection>().defined(),
        selectedAuthMethodId: yup.string().defined(),
        selectedAuthCredentialsId: yup.string().defined(),
        toolFilterMode: yup.mixed<'all' | 'select'>().oneOf(['all', 'select']).required(),
        selectedToolKeys: yup.array().of(yup.string().required()).defined()
      })
  });
  let selectedAuthMethod = authMethods.data?.items.find(
    method => method.id === form.values.selectedAuthMethodId
  );
  let authCredentials = useProviderAuthCredentials(
    instance.data?.id,
    effectiveShowAuth
      ? {
          providerId: p.providerId,
          ...(form.values.selectedAuthMethodId
            ? { providerAuthMethodId: form.values.selectedAuthMethodId }
            : {}),
          origin: ['custom', 'managed']
        }
      : null
  );

  useEffect(() => {
    if (!effectiveShowAuth) return;
    if (authMethods.isLoading) return;
    if (form.values.selectedAuthMethodId) return;
    if ((authMethods.data?.items.length ?? 0) !== 1) return;

    form.setFieldValue('selectedAuthMethodId', authMethods.data!.items[0]!.id);
  }, [
    effectiveShowAuth,
    authMethods.isLoading,
    authMethods.data?.items,
    form.values.selectedAuthMethodId
  ]);

  useEffect(() => {
    if (selectedAuthMethod?.type === 'oauth') return;
    if (!form.values.selectedAuthCredentialsId) return;

    form.setFieldValue('selectedAuthCredentialsId', '');
    form.setFieldTouched('selectedAuthCredentialsId', false, false);
    form.setFieldError('selectedAuthCredentialsId', undefined);
  }, [selectedAuthMethod?.type, form.values.selectedAuthCredentialsId]);

  useEffect(() => {
    if (!form.values.selectedAuthCredentialsId) return;
    if (authCredentials.isLoading) return;

    let credentialExists = (authCredentials.data?.items ?? []).some(
      credential => credential.id === form.values.selectedAuthCredentialsId
    );

    if (!credentialExists) {
      form.setFieldValue('selectedAuthCredentialsId', '');
      form.setFieldTouched('selectedAuthCredentialsId', false, false);
      form.setFieldError('selectedAuthCredentialsId', undefined);
    }
  }, [
    authCredentials.isLoading,
    authCredentials.data?.items,
    form.values.selectedAuthCredentialsId
  ]);

  let hasVisibleInputs =
    visibility.showConfig || effectiveShowAuth || visibility.showToolFilters;
  let isSaving =
    createDeployment.isPending ||
    createConfig.isLoading ||
    createIntegrationProvider.isPending ||
    updateIntegrationProvider.isPending;

  useEffect(() => {
    // Update flows must always show the panel so the user can change settings;
    // never silently submit on their behalf.
    if (isUpdate) return;
    if (visibility.isLoading || hasVisibleInputs || isSaving) return;
    if (autoSubmitAttemptedRef.current) return;
    autoSubmitAttemptedRef.current = true;
    void submitProviderSetup(form.values);
  }, [isUpdate, visibility.isLoading, hasVisibleInputs, isSaving, form.values]);

  if (visibility.isLoading || (!hasVisibleInputs && isSaving)) return <CenteredSpinner />;
  // In create mode with nothing to configure, the auto-submit useEffect above
  // handles the silent submission, so showing a fallback "Cancel" UI is enough.
  // In update mode we never auto-submit, so we always need to render the form
  // so the user has Save / Cancel controls and access to whatever sections do
  // apply (config, auth, tool filters).
  if (!hasVisibleInputs && !isUpdate) {
    return (
      <Flex direction="column" gap={12}>
        <createDeployment.RenderError />
        <createConfig.RenderError />
        <createIntegrationProvider.RenderError />
        <updateIntegrationProvider.RenderError />
        <Dialog.Actions>
          {p.onBack ? (
            <Button type="button" variant="outline" onClick={p.onBack}>
              Back
            </Button>
          ) : (
            <Button type="button" variant="outline" onClick={p.close}>
              Cancel
            </Button>
          )}
        </Dialog.Actions>
      </Flex>
    );
  }

  return (
    <form onSubmit={form.handleSubmit}>
      <Flex direction="column" gap={12}>
        <IntegrationProviderSummaryCard
          instanceId={instance.data!.id}
          providerId={p.providerId}
          providerName={visibility.providerName}
        />

        {effectiveShowAuth ? (
          <IntegrationProviderAuthSection
            instanceId={instance.data!.id}
            providerId={p.providerId}
            authMethods={authMethods}
            selectedAuthMethod={selectedAuthMethod}
            authCredentials={authCredentials}
            selectedAuthMethodId={form.values.selectedAuthMethodId}
            onSelectedAuthMethodIdChange={value => {
              form.setFieldValue('selectedAuthMethodId', value);
              form.setFieldTouched('selectedAuthMethodId', false, false);
              form.setFieldError('selectedAuthMethodId', undefined);
            }}
            selectedAuthCredentialsId={form.values.selectedAuthCredentialsId}
            onSelectedAuthCredentialsIdChange={value => {
              form.setFieldValue('selectedAuthCredentialsId', value);
              form.setFieldTouched('selectedAuthCredentialsId', false, false);
              form.setFieldError('selectedAuthCredentialsId', undefined);
            }}
            authMethodError={<form.RenderError field="selectedAuthMethodId" />}
            authCredentialsError={<form.RenderError field="selectedAuthCredentialsId" />}
          />
        ) : null}

        <ProviderSetupSections
          instanceId={instance.data!.id}
          providerId={p.providerId}
          providerName={visibility.providerName}
          showProviderSummary={false}
          selectedConfiguration={form.values.selectedConfiguration}
          onSelectedConfigurationChange={value =>
            form.setFieldValue('selectedConfiguration', value)
          }
          selectedAuthConfigId=""
          onSelectedAuthConfigIdChange={() => {}}
          toolFilterMode={form.values.toolFilterMode}
          onToolFilterModeChange={value => form.setFieldValue('toolFilterMode', value)}
          selectedToolKeys={form.values.selectedToolKeys}
          onSelectedToolKeysChange={keys => form.setFieldValue('selectedToolKeys', keys)}
          showConfigSection={visibility.showConfig}
          forceConfigSectionVisible={isUpdate}
          showAuthSection={false}
          showToolFilters={visibility.showToolFilters}
          configRequirement="optional"
          authRequirement="optional"
          emptyState={null}
          supplementaryContent={
            <>
              <createDeployment.RenderError />
              <createConfig.RenderError />
              <createIntegrationProvider.RenderError />
              <updateIntegrationProvider.RenderError />
            </>
          }
          footer={
            <Dialog.Actions>
              {p.onBack ? (
                <Button type="button" variant="outline" onClick={p.onBack}>
                  Back
                </Button>
              ) : (
                <Button type="button" variant="outline" onClick={p.close}>
                  Cancel
                </Button>
              )}
              <Button type="submit" loading={isSaving}>
                {p.integrationProvider ? 'Save Provider' : 'Add Provider'}
              </Button>
            </Dialog.Actions>
          }
        />
      </Flex>
    </form>
  );
};

let AddIntegrationProviderPanel = (p: {
  integration: IntegrationPreview;
  integrationProvider?: IntegrationProvider;
  close: () => void;
  setPanelWidth: (width: number) => void;
  onComplete: () => void;
}) => {
  let instance = useCurrentInstance();
  let [step, setStep] = useState(p.integrationProvider ? 1 : 0);
  let [providerId, setProviderId] = useState(p.integrationProvider?.provider?.id ?? '');
  let excludedProviderIds = useMemo(
    () =>
      (p.integration.providers ?? [])
        .filter(provider => provider.status !== 'archived')
        .map(provider => provider.provider.id),
    [p.integration.providers]
  );

  useEffect(() => {
    p.setPanelWidth(step === 0 ? 1050 : 660);
  }, [step, p.setPanelWidth]);

  let steps = useMemo(
    () => [
      {
        title: 'Select Provider',
        render: () => (
          <ProviderSelectionStep
            instanceId={instance.data!.id}
            excludeProviderIds={excludedProviderIds}
            emptyText="All available providers are already attached to this integration."
            onSelect={nextProviderId => {
              setProviderId(nextProviderId);
              setStep(1);
            }}
          />
        )
      },
      {
        title: 'Configure',
        render: () =>
          providerId ? (
            <IntegrationProviderSetupStep
              integration={p.integration}
              integrationProvider={p.integrationProvider}
              providerId={providerId}
              close={p.close}
              onBack={p.integrationProvider ? undefined : () => setStep(0)}
              onComplete={p.onComplete}
            />
          ) : (
            <CenteredSpinner />
          )
      }
    ],
    [
      instance.data?.id,
      providerId,
      p.integration,
      p.integrationProvider,
      p.close,
      p.onComplete
    ]
  );

  return (
    <ProviderCreationPanelShell
      title={p.integrationProvider ? 'Edit Provider' : 'Add Provider'}
      description={
        p.integrationProvider
          ? 'Update optional provider settings for this integration.'
          : 'Select a provider. Deployment and empty configuration setup are handled automatically.'
      }
      steps={p.integrationProvider ? [steps[1]!] : steps}
      currentStep={p.integrationProvider ? 0 : step}
      setCurrentStep={nextStep => {
        if (p.integrationProvider) return;
        if (nextStep === 0 || providerId) setStep(nextStep);
      }}
      isStepDisabled={nextStep => nextStep === 1 && !providerId}
      hideStepper={!!p.integrationProvider}
    />
  );
};

export let showIntegrationProviderPanelFlow = (p: {
  integration: IntegrationPreview;
  integrationProvider?: IntegrationProvider;
  onComplete: () => void;
}) =>
  showProviderCreationPanel(({ close, setWidth }) => (
    <AddIntegrationProviderPanel
      integration={p.integration}
      integrationProvider={p.integrationProvider}
      close={close}
      setPanelWidth={setWidth}
      onComplete={p.onComplete}
    />
  ));

let IntegrationInstanceProviderPanel = (p: {
  integration: IntegrationPreview;
  integrationInstance: IntegrationInstance;
  integrationProvider: IntegrationProvider;
  instanceProvider?: IntegrationInstanceProvider;
  close: () => void;
  onComplete: () => void;
}) => {
  let instance = useCurrentInstance();
  let providerId = p.integrationProvider.provider.id;
  let setProvider = useSetIntegrationInstanceProvider();
  let createConfig = useCreateProviderConfig();
  let autoSubmitAttemptedRef = useRef(false);
  let isUpdate = !!p.instanceProvider;
  let visibility = useProviderSetupVisibility({
    instanceId: instance.data?.id,
    providerId,
    integration: p.integration,
    existingConfigId: p.instanceProvider?.config?.id ?? p.integrationProvider.config?.id,
    isUpdate
  });

  let submitProviderSetup = async (values: IntegrationInstanceProviderFormValues) => {
    if (!instance.data || !providerId) return false;

    let providerConfigId =
      values.selectedConfiguration.kind === 'config'
        ? values.selectedConfiguration.id
        : undefined;

    if (!providerConfigId && visibility.shouldAutoCreateEmptyConfig) {
      let [config] = await createConfig.mutate({
        instanceId: instance.data.id,
        providerId,
        name: `${visibility.providerName} Config`,
        value: {}
      });
      providerConfigId = config?.id;
    }

    let [result] = await setProvider.mutate({
      instanceId: instance.data.id,
      integrationInstanceId: p.integrationInstance.id,
      providerId,
      providerDeploymentId: p.integrationProvider.deployment.id,
      providerConfigId: providerConfigId ?? undefined,
      providerAuthConfigId: values.selectedAuthConfigId || undefined,
      toolFilters: getToolFilters(values),
      isOverrideToolFilter: values.toolFilterMode === 'select'
    });
    if (!result) return false;
    p.onComplete();
    p.close();
    return true;
  };

  let form = useForm<
    IntegrationInstanceProviderFormValues,
    IntegrationInstanceProviderFormValues
  >({
    initialValues: {
      selectedProviderId: providerId ?? '',
      selectedConfiguration: p.instanceProvider?.config?.id
        ? { kind: 'config', id: p.instanceProvider.config.id }
        : emptyConfigurationSelection(),
      selectedAuthConfigId: p.instanceProvider?.authConfig?.id ?? '',
      toolFilterMode: p.instanceProvider?.toolFilter?.type === 'filter' ? 'select' : 'all',
      selectedToolKeys:
        p.instanceProvider?.toolFilter?.type === 'filter'
          ? p.instanceProvider.toolFilter.filters.flatMap(filter =>
              filter.type === 'tool_keys' ? filter.keys : []
            )
          : []
    },
    onSubmit: submitProviderSetup,
    schema: yup =>
      yup.object({
        selectedProviderId: yup.string().required(),
        selectedConfiguration: yup.mixed<ConfigurationSelection>().defined(),
        selectedAuthConfigId: yup.string().defined(),
        toolFilterMode: yup.mixed<'all' | 'select'>().oneOf(['all', 'select']).required(),
        selectedToolKeys: yup.array().of(yup.string().required()).defined()
      })
  });

  let shouldAutoCreateWithoutPanel =
    !isUpdate && !visibility.showConfig && !visibility.showAuth;
  let hasVisibleInputs = shouldAutoCreateWithoutPanel
    ? false
    : visibility.showConfig || visibility.showAuth || visibility.showToolFilters;
  let isSaving = setProvider.isPending || createConfig.isLoading;

  useEffect(() => {
    // Update flows must always show the panel so the user can change settings;
    // never silently submit on their behalf.
    if (isUpdate) return;
    if (visibility.isLoading || hasVisibleInputs || isSaving) return;
    if (autoSubmitAttemptedRef.current) return;

    autoSubmitAttemptedRef.current = true;
    void submitProviderSetup(form.values);
  }, [isUpdate, visibility.isLoading, hasVisibleInputs, isSaving, form.values]);

  if (!providerId || visibility.isLoading || (!hasVisibleInputs && isSaving)) {
    return <CenteredSpinner />;
  }
  // In create mode with nothing to configure, the auto-submit useEffect above
  // handles the silent submission, so showing a fallback "Close" UI is enough.
  // In update mode we never auto-submit, so we always need to render the form
  // so the user has Save / Cancel controls and access to whatever sections do
  // apply (config, auth, tool filters).
  if (!hasVisibleInputs && !isUpdate) {
    return (
      <Flex direction="column" gap={12}>
        <setProvider.RenderError />
        <createConfig.RenderError />
        <Dialog.Actions>
          <Button type="button" variant="outline" onClick={p.close}>
            Close
          </Button>
        </Dialog.Actions>
      </Flex>
    );
  }

  return (
    <>
      <ProviderCreationPanelShell
        title="Configure Instance Provider"
        description="Set provider-specific overrides for this integration instance."
        hideStepper
        currentStep={0}
        setCurrentStep={() => {}}
        steps={[
          {
            title: 'Configure',
            render: () => (
              <form onSubmit={form.handleSubmit}>
                <ProviderSetupSections
                  instanceId={instance.data!.id}
                  providerId={providerId}
                  providerName={visibility.providerName}
                  selectedConfiguration={form.values.selectedConfiguration}
                  onSelectedConfigurationChange={value =>
                    form.setFieldValue('selectedConfiguration', value)
                  }
                  selectedAuthConfigId={form.values.selectedAuthConfigId}
                  onSelectedAuthConfigIdChange={value =>
                    form.setFieldValue('selectedAuthConfigId', value)
                  }
                  toolFilterMode={form.values.toolFilterMode}
                  onToolFilterModeChange={value => form.setFieldValue('toolFilterMode', value)}
                  selectedToolKeys={form.values.selectedToolKeys}
                  onSelectedToolKeysChange={keys =>
                    form.setFieldValue('selectedToolKeys', keys)
                  }
                  showConfigSection={visibility.showConfig}
                  forceConfigSectionVisible={isUpdate}
                  showAuthSection={visibility.showAuth}
                  showToolFilters={visibility.showToolFilters}
                  configRequirement="optional"
                  authRequirement="optional"
                  supplementaryContent={
                    <>
                      <setProvider.RenderError />
                      <createConfig.RenderError />
                    </>
                  }
                  footer={
                    <Dialog.Actions>
                      <Button type="button" variant="outline" onClick={p.close}>
                        Cancel
                      </Button>
                      <Button type="submit" loading={isSaving}>
                        Save Provider
                      </Button>
                    </Dialog.Actions>
                  }
                />
              </form>
            )
          }
        ]}
      />
    </>
  );
};

export let showIntegrationInstanceProviderPanelFlow = (p: {
  integration: IntegrationPreview;
  integrationInstance: IntegrationInstance;
  integrationProvider: IntegrationProvider;
  instanceProvider?: IntegrationInstanceProvider;
  onComplete: () => void;
}) =>
  showProviderCreationPanel(
    ({ close }) => (
      <IntegrationInstanceProviderPanel {...p} close={close} onComplete={p.onComplete} />
    ),
    { width: 660 }
  );
