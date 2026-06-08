import { useForm } from '@metorial/data-hooks';
import {
  IntegrationInstance,
  IntegrationInstanceProvider,
  IntegrationPreview,
  IntegrationProvider,
  useCreateIntegration,
  useCreateIntegrationProvider,
  useCreateProviderConfig,
  useCreateProviderDeployment,
  useCurrentInstance,
  useProvider,
  useProviderAuthCredential,
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
  Callout,
  CenteredSpinner,
  Combobox,
  Dialog,
  Entity,
  Flex,
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
import { getProviderOAuthAutoRegistrationEnabled } from '../../lib/providerOAuthAutoRegistration';
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

export type IntegrationProviderPanelSubmitInput = {
  providerId: string;
  providerName?: string;
  providerDescription?: string | null;
  providerDeploymentId: string;
  providerConfigId?: string | null;
  providerAuthMethodId?: string | null;
  providerAuthCredentialsId?: string | null;
  toolFilters?: ReturnType<typeof getToolFilters>;
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
    : null;

let isConfigSelectionComplete = (selection: ConfigurationSelection) =>
  selection.kind !== 'none';

let useProviderSetupVisibility = (p: {
  instanceId: string | null | undefined;
  providerId: string | null | undefined;
  integration: IntegrationPreview | null | undefined;
  existingConfigId?: string | null;
  inheritedConfigId?: string | null;
  instanceConfigId?: string | null;
  allowAuthConfig?: boolean;
  respectIntegrationCustomConfigPolicy?: boolean;
  respectIntegrationToolFilterPolicy?: boolean;
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
  if (p.respectIntegrationToolFilterPolicy === false) allowToolFilters = true;
  let providerSupportsAuth = provider.data?.type.auth.status === 'enabled';
  let requiresProviderConfig =
    providerSupportsConfig && !configCapabilities.canAutoCreateEmptyConfig;
  let hasEditableConfigFields = configCapabilities.hasSchemaFields;
  let isInstanceProviderPanel =
    p.inheritedConfigId !== undefined || p.instanceConfigId !== undefined;
  let satisfiedConfigId = isInstanceProviderPanel
    ? (p.instanceConfigId ?? p.inheritedConfigId ?? null)
    : (p.existingConfigId ?? null);
  let mustRequestInstanceConfig =
    isInstanceProviderPanel && requiresProviderConfig && !satisfiedConfigId;
  // Auto-creating an empty config silently is only desirable on initial
  // creation when the schema has no required fields. In update flows, the user
  // opened the panel deliberately and should be given a chance to set/clear a
  // config explicitly.
  let shouldAutoCreateEmptyConfig =
    !p.isUpdate &&
    allowCustomConfigs &&
    !satisfiedConfigId &&
    configCapabilities.canAutoCreateEmptyConfig &&
    !configCapabilities.isLoading;
  // In update mode the user explicitly opened the panel to make changes -- we
  // surface the config picker even for providers whose config support isn't
  // strictly "enabled" (e.g. providers that only ever take an empty config),
  // because the API still accepts a configId for them.
  let showConfig = p.isUpdate
    ? allowCustomConfigs
    : mustRequestInstanceConfig ||
      (allowCustomConfigs &&
        providerSupportsConfig &&
        (hasEditableConfigFields || !shouldAutoCreateEmptyConfig));
  let configRequirement: 'required' | 'optional' = isInstanceProviderPanel
    ? mustRequestInstanceConfig
      ? 'required'
      : 'optional'
    : requiresProviderConfig
      ? 'required'
      : 'optional';

  return {
    provider,
    isLoading: provider.isLoading || configCapabilities.isLoading,
    showConfig,
    showAuth: (p.allowAuthConfig ?? true) && providerSupportsAuth,
    showToolFilters: allowToolFilters,
    shouldAutoCreateEmptyConfig,
    defaultConfigValue: configCapabilities.defaultConfigValue,
    configRequirement,
    mustRequestInstanceConfig,
    providerName: getProviderName(provider.data, p.providerId ?? undefined),
    providerDescription: provider.data?.description
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
  providerDeploymentId?: string;
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
  selectedAuthMethodId: string;
  onSelectedAuthMethodIdChange: (value: string) => void;
  selectedAuthCredentialsId: string;
  selectedAuthCredentialsLabel?: string;
  onSelectedAuthCredentialsIdChange: (
    value: string,
    credentials?: { id: string; name?: string | null }
  ) => void;
  oauthAutoRegistrationEnabled?: boolean;
  authMethodError?: React.ReactNode;
  authCredentialsError?: React.ReactNode;
}) => {
  let authMethodItems = p.authMethods.data?.items ?? [];
  let showAuthCredentials =
    p.selectedAuthMethod?.type === 'oauth' && !p.oauthAutoRegistrationEnabled;

  return (
    <Flex direction="column" gap={12}>
      {p.authMethods.isLoading ? (
        <CenteredSpinner />
      ) : authMethodItems.length > 0 ? (
        <>
          <ConfigureSectionCard
            title="Auth Method"
            description="Choose how this integration authenticates with the provider."
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
              {p.selectedAuthMethod?.type === 'oauth' && p.oauthAutoRegistrationEnabled ? (
                <Callout color="gray">
                  OAuth credentials will be registered automatically for this provider.
                </Callout>
              ) : null}
            </Flex>
          </ConfigureSectionCard>

          <AnimatePresence initial={false}>
            {showAuthCredentials ? (
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
                  description="Select or create the OAuth credentials this integration should use."
                  requirement="required"
                  completed={Boolean(p.selectedAuthCredentialsId)}
                >
                  <Flex direction="column" gap={10}>
                    <Flex gap={8} align="end">
                      <div style={{ flex: 1 }}>
                        <Combobox
                          label="Auth Credentials"
                          placeholder="Search auth credentials"
                          value={p.selectedAuthCredentialsId || null}
                          valueLabel={p.selectedAuthCredentialsLabel}
                          provider={({ searchQuery }) => {
                            let comboboxCredentials = useProviderAuthCredentials(
                              p.instanceId,
                              {
                                ...(p.providerDeploymentId
                                  ? { providerDeploymentId: p.providerDeploymentId }
                                  : { providerId: p.providerId }),
                                ...(p.selectedAuthMethodId
                                  ? { providerAuthMethodId: p.selectedAuthMethodId }
                                  : {}),
                                origin: ['custom', 'managed'],
                                limit: 25,
                                search: searchQuery || undefined
                              }
                            );

                            return {
                              items: (comboboxCredentials.data?.items ?? []).map(
                                credentials => ({
                                  id: credentials.id,
                                  label: credentials.name ?? credentials.id
                                })
                              ),
                              isLoading: comboboxCredentials.isLoading,
                              empty: searchQuery
                                ? 'No matching auth credentials found.'
                                : 'No auth credentials available.'
                            };
                          }}
                          onChange={value => {
                            p.onSelectedAuthCredentialsIdChange(value ?? '');
                          }}
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
                              deploymentId: p.providerDeploymentId,
                              onCreate: credentials => {
                                p.onSelectedAuthCredentialsIdChange(
                                  credentials.id,
                                  credentials
                                );
                              }
                            })
                          }
                        >
                          Create Auth Credentials
                        </Button>
                      </div>
                    </Flex>
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
  integration?: IntegrationPreview;
  providerId: string;
  integrationProvider?: IntegrationProvider;
  close: () => void;
  onBack?: () => void;
  onComplete: () => void;
  submitLabel?: string;
  onSubmitProvider?: (
    input: IntegrationProviderPanelSubmitInput
  ) => Promise<{ error?: unknown; success?: boolean }>;
}) => {
  let instance = useCurrentInstance();
  let createDeployment = useCreateProviderDeployment();
  let createConfig = useCreateProviderConfig();
  let createIntegrationProvider = useCreateIntegrationProvider();
  let updateIntegrationProvider = useUpdateIntegrationProvider();
  let autoSubmitAttemptedRef = useRef(false);
  let managedAuthCredentialsDefaultedKeysRef = useRef(new Set<string>());
  let [createdAuthCredentialsSelection, setCreatedAuthCredentialsSelection] = useState<{
    id: string;
    label: string;
  } | null>(null);
  let isUpdate = !!p.integrationProvider;
  let visibility = useProviderSetupVisibility({
    instanceId: instance.data?.id,
    providerId: p.providerId,
    integration: p.integration ?? null,
    existingConfigId: p.integrationProvider?.config?.id,
    respectIntegrationCustomConfigPolicy: false,
    respectIntegrationToolFilterPolicy: false,
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
    (!isUpdate || (!authMethods.isLoading && (authMethods.data?.items.length ?? 0) > 0));
  let oauthAutoRegistrationEnabled = getProviderOAuthAutoRegistrationEnabled(
    visibility.provider.data
  );

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
        value: visibility.defaultConfigValue
      });
      providerConfigId = config?.id;
    }

    let providerAuthMethodId = values.selectedAuthMethodId || undefined;
    let providerAuthCredentialsId =
      selectedAuthMethod?.type === 'oauth' && !oauthAutoRegistrationEnabled
        ? values.selectedAuthCredentialsId || undefined
        : undefined;

    let toolFilters = getToolFilters(values);

    if (p.integrationProvider) {
      let [updated] = await updateIntegrationProvider.mutate({
        instanceId: instance.data.id,
        integrationProviderId: p.integrationProvider.id,
        providerConfigId: providerConfigId ?? null,
        providerAuthMethodId: providerAuthMethodId ?? null,
        providerAuthCredentialsId: providerAuthCredentialsId ?? null,
        toolFilters
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

    if (p.onSubmitProvider) {
      let result = await p.onSubmitProvider({
        providerId: p.providerId,
        providerName: visibility.providerName,
        providerDescription: visibility.providerDescription ?? undefined,
        providerDeploymentId: deployment.id,
        providerConfigId: providerConfigId ?? null,
        providerAuthMethodId: providerAuthMethodId ?? null,
        providerAuthCredentialsId: providerAuthCredentialsId ?? null,
        toolFilters
      });

      if (result.error || !result.success) return false;

      p.onComplete();
      p.close();
      return true;
    }

    if (!p.integration) return false;

    let [created] = await createIntegrationProvider.mutate({
      instanceId: instance.data.id,
      integrationId: p.integration.id,
      providerId: p.providerId,
      providerDeploymentId: deployment.id,
      providerConfigId: providerConfigId ?? null,
      providerAuthMethodId,
      providerAuthCredentialsId,
      toolFilters
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

        if (
          selectedAuthMethod?.type === 'oauth' &&
          !oauthAutoRegistrationEnabled &&
          !values.selectedAuthCredentialsId
        ) {
          form.setFieldTouched('selectedAuthCredentialsId', true, false);
          form.setFieldError('selectedAuthCredentialsId', 'Select auth credentials');
          return;
        }
      }

      if (
        visibility.configRequirement === 'required' &&
        !isConfigSelectionComplete(values.selectedConfiguration)
      ) {
        form.setFieldTouched('selectedConfiguration', true, false);
        form.setFieldError('selectedConfiguration', 'Select a config');
        return;
      }

      await submitProviderSetup(values);
    },
    schema: yup =>
      yup.object({
        selectedProviderId: yup.string().required(),
        selectedConfiguration: yup.mixed<ConfigurationSelection>().defined(),
        selectedAuthMethodId: yup.string().optional().default(''),
        selectedAuthCredentialsId: yup.string().optional().default(''),
        toolFilterMode: yup.mixed<'all' | 'select'>().oneOf(['all', 'select']).required(),
        selectedToolKeys: yup.array().of(yup.string().required()).defined()
      })
  });
  let selectedAuthMethod = authMethods.data?.items.find(
    method => method.id === form.values.selectedAuthMethodId
  );
  let requiresAuthCredentials =
    selectedAuthMethod?.type === 'oauth' && !oauthAutoRegistrationEnabled;
  let authCredentials = useProviderAuthCredentials(
    instance.data?.id,
    effectiveShowAuth && requiresAuthCredentials
      ? {
          providerId: p.providerId,
          ...(form.values.selectedAuthMethodId
            ? { providerAuthMethodId: form.values.selectedAuthMethodId }
            : {}),
          origin: ['custom', 'managed']
        }
      : null
  );
  let managedAuthCredentials = useProviderAuthCredentials(
    instance.data?.id,
    effectiveShowAuth && requiresAuthCredentials && form.values.selectedAuthMethodId
      ? {
          ...(p.integrationProvider?.deployment.id
            ? { providerDeploymentId: p.integrationProvider.deployment.id }
            : { providerId: p.providerId }),
          providerAuthMethodId: form.values.selectedAuthMethodId,
          origin: ['managed'],
          limit: 10
        }
      : null
  );
  let preferredManagedAuthCredential =
    managedAuthCredentials.data?.items.find(credential => credential.isDefault) ??
    managedAuthCredentials.data?.items[0];
  let managedAuthCredentialsDefaultKey = [
    instance.data?.id ?? '',
    p.providerId,
    p.integrationProvider?.deployment.id ?? '',
    form.values.selectedAuthMethodId
  ].join(':');
  let selectedAuthCredential = useProviderAuthCredential(
    instance.data?.id,
    form.values.selectedAuthCredentialsId || null
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
    if (authMethods.isLoading) return;
    if (selectedAuthMethod?.type === 'oauth' && !oauthAutoRegistrationEnabled) return;
    if (!form.values.selectedAuthCredentialsId) return;

    form.setFieldValue('selectedAuthCredentialsId', '');
    form.setFieldTouched('selectedAuthCredentialsId', false, false);
    form.setFieldError('selectedAuthCredentialsId', undefined);
    setCreatedAuthCredentialsSelection(null);
  }, [
    authMethods.isLoading,
    oauthAutoRegistrationEnabled,
    selectedAuthMethod?.type,
    form.values.selectedAuthCredentialsId
  ]);

  useEffect(() => {
    if (!effectiveShowAuth) return;
    if (!requiresAuthCredentials) return;
    if (!form.values.selectedAuthMethodId) return;
    if (form.values.selectedAuthCredentialsId) return;
    if (managedAuthCredentials.isLoading) return;
    if (!preferredManagedAuthCredential) return;
    if (managedAuthCredentialsDefaultedKeysRef.current.has(managedAuthCredentialsDefaultKey)) {
      return;
    }

    managedAuthCredentialsDefaultedKeysRef.current.add(managedAuthCredentialsDefaultKey);
    form.setFieldValue('selectedAuthCredentialsId', preferredManagedAuthCredential.id);
    form.setFieldTouched('selectedAuthCredentialsId', false, false);
    form.setFieldError('selectedAuthCredentialsId', undefined);
    setCreatedAuthCredentialsSelection({
      id: preferredManagedAuthCredential.id,
      label: preferredManagedAuthCredential.name ?? preferredManagedAuthCredential.id
    });
  }, [
    effectiveShowAuth,
    requiresAuthCredentials,
    managedAuthCredentials.isLoading,
    managedAuthCredentialsDefaultKey,
    preferredManagedAuthCredential?.id,
    preferredManagedAuthCredential?.name,
    form.values.selectedAuthMethodId,
    form.values.selectedAuthCredentialsId
  ]);

  useEffect(() => {
    if (!effectiveShowAuth) return;
    if (!form.values.selectedAuthCredentialsId) return;
    if (authCredentials.isLoading) return;
    if (selectedAuthCredential.isLoading) return;

    let credentialExists = (authCredentials.data?.items ?? []).some(
      credential => credential.id === form.values.selectedAuthCredentialsId
    );
    let selectedCredentialExists =
      selectedAuthCredential.data?.id === form.values.selectedAuthCredentialsId;

    if (!credentialExists && !selectedCredentialExists) {
      form.setFieldValue('selectedAuthCredentialsId', '');
      form.setFieldTouched('selectedAuthCredentialsId', false, false);
      form.setFieldError('selectedAuthCredentialsId', undefined);
      setCreatedAuthCredentialsSelection(null);
    }
  }, [
    effectiveShowAuth,
    authCredentials.isLoading,
    authCredentials.data?.items,
    selectedAuthCredential.isLoading,
    selectedAuthCredential.data?.id,
    form.values.selectedAuthCredentialsId
  ]);

  let hasVisibleInputs =
    visibility.showConfig || effectiveShowAuth || visibility.showToolFilters;
  let canSubmit =
    (visibility.configRequirement !== 'required' ||
      isConfigSelectionComplete(form.values.selectedConfiguration)) &&
    (!effectiveShowAuth ||
      (Boolean(form.values.selectedAuthMethodId) &&
        (!requiresAuthCredentials || Boolean(form.values.selectedAuthCredentialsId))));
  let isSaving =
    createDeployment.isPending ||
    createConfig.isLoading ||
    createIntegrationProvider.isPending ||
    updateIntegrationProvider.isPending;
  let isLoadingInitialData =
    visibility.isLoading || (effectiveShowAuth && authMethods.isLoading);

  useEffect(() => {
    // Update flows must always show the panel so the user can change settings;
    // never silently submit on their behalf.
    if (isUpdate) return;
    if (isLoadingInitialData || hasVisibleInputs || isSaving) return;
    if (
      visibility.configRequirement === 'required' &&
      !isConfigSelectionComplete(form.values.selectedConfiguration)
    )
      return;
    if (autoSubmitAttemptedRef.current) return;
    autoSubmitAttemptedRef.current = true;
    void submitProviderSetup(form.values);
  }, [isUpdate, isLoadingInitialData, hasVisibleInputs, isSaving, form.values]);

  if (isLoadingInitialData || (!hasVisibleInputs && isSaving)) return <CenteredSpinner />;
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
    <form noValidate onSubmit={form.handleSubmit}>
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
            providerDeploymentId={p.integrationProvider?.deployment.id}
            authMethods={authMethods}
            selectedAuthMethod={selectedAuthMethod}
            selectedAuthMethodId={form.values.selectedAuthMethodId}
            onSelectedAuthMethodIdChange={value => {
              form.setFieldValue('selectedAuthMethodId', value);
              form.setFieldTouched('selectedAuthMethodId', false, false);
              form.setFieldError('selectedAuthMethodId', undefined);

              if (value !== form.values.selectedAuthMethodId) {
                form.setFieldValue('selectedAuthCredentialsId', '');
                form.setFieldTouched('selectedAuthCredentialsId', false, false);
                form.setFieldError('selectedAuthCredentialsId', undefined);
                setCreatedAuthCredentialsSelection(null);
              }
            }}
            selectedAuthCredentialsId={form.values.selectedAuthCredentialsId}
            selectedAuthCredentialsLabel={
              selectedAuthCredential.data?.name ??
              selectedAuthCredential.data?.id ??
              (createdAuthCredentialsSelection?.id === form.values.selectedAuthCredentialsId
                ? createdAuthCredentialsSelection.label
                : undefined) ??
              authCredentials.data?.items.find(
                credential => credential.id === form.values.selectedAuthCredentialsId
              )?.name ??
              form.values.selectedAuthCredentialsId
            }
            onSelectedAuthCredentialsIdChange={(value, credentials) => {
              managedAuthCredentialsDefaultedKeysRef.current.add(
                managedAuthCredentialsDefaultKey
              );
              form.setFieldValue('selectedAuthCredentialsId', value);
              form.setFieldTouched('selectedAuthCredentialsId', false, false);
              form.setFieldError('selectedAuthCredentialsId', undefined);

              if (credentials && value) {
                setCreatedAuthCredentialsSelection({
                  id: credentials.id,
                  label: credentials.name ?? credentials.id
                });
                return;
              }

              if (!value || createdAuthCredentialsSelection?.id !== value) {
                setCreatedAuthCredentialsSelection(null);
              }
            }}
            oauthAutoRegistrationEnabled={oauthAutoRegistrationEnabled}
            authMethodError={<form.RenderError field="selectedAuthMethodId" />}
            authCredentialsError={<form.RenderError field="selectedAuthCredentialsId" />}
          />
        ) : null}

        <ProviderSetupSections
          instanceId={instance.data!.id}
          providerId={p.providerId}
          providerDeploymentId={p.integrationProvider?.deployment.id}
          providerName={visibility.providerName}
          showProviderSummary={false}
          selectedConfiguration={form.values.selectedConfiguration}
          onSelectedConfigurationChange={value => {
            form.setFieldValue('selectedConfiguration', value);
            form.setFieldTouched('selectedConfiguration', false, false);
            form.setFieldError('selectedConfiguration', undefined);
          }}
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
          configRequirement={visibility.configRequirement}
          authRequirement="optional"
          configError={<form.RenderError field="selectedConfiguration" />}
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
              <Button
                type="button"
                disabled={!canSubmit}
                loading={isSaving}
                onClick={() => {
                  void form.submitForm();
                }}
              >
                {p.submitLabel ?? (p.integrationProvider ? 'Save Provider' : 'Add Provider')}
              </Button>
            </Dialog.Actions>
          }
        />
      </Flex>
    </form>
  );
};

let AddIntegrationProviderPanel = (p: {
  integration?: IntegrationPreview;
  integrationProvider?: IntegrationProvider;
  providerId?: string;
  hideProviderStep?: boolean;
  close: () => void;
  setPanelWidth: (width: number) => void;
  onComplete: () => void;
  title?: string;
  description?: string;
  submitLabel?: string;
  onSubmitProvider?: (
    input: IntegrationProviderPanelSubmitInput
  ) => Promise<{ error?: unknown; success?: boolean }>;
}) => {
  let instance = useCurrentInstance();
  let [step, setStep] = useState(p.integrationProvider || p.providerId ? 1 : 0);
  let [providerId, setProviderId] = useState(
    p.integrationProvider?.provider?.id ?? p.providerId ?? ''
  );
  let excludedProviderIds = useMemo(
    () =>
      (p.integration?.providers ?? [])
        .filter(provider => provider.status !== 'archived')
        .map(provider => provider.provider.id),
    [p.integration?.providers]
  );

  useEffect(() => {
    p.setPanelWidth(!p.hideProviderStep && step === 0 ? 1050 : 660);
  }, [step, p.hideProviderStep, p.setPanelWidth]);

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
              onBack={
                p.integrationProvider || p.hideProviderStep ? undefined : () => setStep(0)
              }
              onComplete={p.onComplete}
              submitLabel={p.submitLabel}
              onSubmitProvider={p.onSubmitProvider}
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
      p.hideProviderStep,
      p.close,
      p.onComplete
    ]
  );

  return (
    <ProviderCreationPanelShell
      title={p.title ?? (p.integrationProvider ? 'Edit Provider' : 'Add Provider')}
      description={
        p.description ??
        (p.integrationProvider
          ? 'Update optional provider settings for this integration.'
          : 'Choose a provider to add to this integration.')
      }
      steps={p.integrationProvider || p.hideProviderStep ? [steps[1]!] : steps}
      currentStep={p.integrationProvider || p.hideProviderStep ? 0 : step}
      setCurrentStep={nextStep => {
        if (p.integrationProvider || p.hideProviderStep) return;
        if (nextStep === 0 || providerId) setStep(nextStep);
      }}
      isStepDisabled={nextStep => nextStep === 1 && !providerId}
      hideStepper={!!p.integrationProvider || !!p.hideProviderStep}
    />
  );
};

export let showIntegrationProviderPanelFlow = (p: {
  integration: IntegrationPreview;
  integrationProvider?: IntegrationProvider;
  onComplete: () => void;
}) =>
  showProviderCreationPanel(
    ({ close, setWidth }) => (
      <AddIntegrationProviderPanel
        integration={p.integration}
        integrationProvider={p.integrationProvider}
        close={close}
        setPanelWidth={setWidth}
        onComplete={p.onComplete}
      />
    ),
    // Edit flow opens directly on the configure step (660px). Without this,
    // the panel mounts at the default width and visibly shrinks after the
    // step's useEffect runs setPanelWidth(660).
    p.integrationProvider ? { width: 660 } : undefined
  );

export let showConfigureIntegrationProviderPanelFlow = (p: {
  title?: string;
  description?: string;
  submitLabel?: string;
  providerId?: string;
  onSubmitProvider: (
    input: IntegrationProviderPanelSubmitInput
  ) => Promise<{ error?: unknown; success?: boolean }>;
  onComplete: () => void;
}) =>
  showProviderCreationPanel(
    ({ close, setWidth }) => (
      <AddIntegrationProviderPanel
        title={p.title}
        description={p.description}
        submitLabel={p.submitLabel}
        providerId={p.providerId}
        hideProviderStep={!!p.providerId}
        close={close}
        setPanelWidth={setWidth}
        onSubmitProvider={p.onSubmitProvider}
        onComplete={p.onComplete}
      />
    ),
    p.providerId ? { width: 660 } : undefined
  );

let CreateIntegrationProviderFirstPanel = (p: {
  providerId?: string;
  close: () => void;
  setPanelWidth: (width: number) => void;
  onCreate?: (integration: IntegrationPreview) => void;
}) => {
  let instance = useCurrentInstance();
  let createIntegration = useCreateIntegration();
  let createIntegrationProvider = useCreateIntegrationProvider();
  let createdIntegrationRef = useRef<IntegrationPreview | null>(null);

  return (
    <AddIntegrationProviderPanel
      providerId={p.providerId}
      hideProviderStep={!!p.providerId}
      close={p.close}
      setPanelWidth={p.setPanelWidth}
      title="Create Integration"
      description={
        p.providerId
          ? 'Configure this provider, then create an integration from it.'
          : 'Select and configure a provider to create an integration.'
      }
      submitLabel="Create Integration"
      onSubmitProvider={async input => {
        if (!instance.data) return { success: false };

        let [integration] = await createIntegration.mutate({
          instanceId: instance.data.id,
          name: input.providerName?.trim() || 'Integration',
          description: undefined
        });
        if (!integration) return { success: false, error: createIntegration.error };

        let [provider] = await createIntegrationProvider.mutate({
          instanceId: instance.data.id,
          integrationId: integration.id,
          providerId: input.providerId,
          providerDeploymentId: input.providerDeploymentId,
          providerConfigId: input.providerConfigId ?? null,
          providerAuthMethodId: input.providerAuthMethodId ?? null,
          providerAuthCredentialsId: input.providerAuthCredentialsId ?? null,
          toolFilters: input.toolFilters
        });
        if (!provider) return { success: false, error: createIntegrationProvider.error };

        createdIntegrationRef.current = integration;
        return { success: true };
      }}
      onComplete={() => {
        if (createdIntegrationRef.current) p.onCreate?.(createdIntegrationRef.current);
      }}
    />
  );
};

export let showCreateIntegrationProviderFirstFlow = (p: {
  providerId?: string;
  onCreate?: (integration: IntegrationPreview) => void;
}) =>
  showProviderCreationPanel(
    ({ close, setWidth }) => (
      <CreateIntegrationProviderFirstPanel
        providerId={p.providerId}
        close={close}
        setPanelWidth={setWidth}
        onCreate={p.onCreate}
      />
    ),
    p.providerId ? { width: 660 } : undefined
  );

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
  let inheritedConfigId = p.integrationProvider.config?.id ?? null;
  let instanceConfigId = p.instanceProvider?.config?.id ?? null;
  let visibility = useProviderSetupVisibility({
    instanceId: instance.data?.id,
    providerId,
    integration: p.integration,
    existingConfigId: instanceConfigId ?? inheritedConfigId,
    inheritedConfigId,
    instanceConfigId,
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
        value: visibility.defaultConfigValue
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

  let initialConfigId = instanceConfigId ?? inheritedConfigId;

  let form = useForm<
    IntegrationInstanceProviderFormValues,
    IntegrationInstanceProviderFormValues
  >({
    initialValues: {
      selectedProviderId: providerId ?? '',
      selectedConfiguration: initialConfigId
        ? { kind: 'config', id: initialConfigId }
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
    onSubmit: async values => {
      if (
        visibility.configRequirement === 'required' &&
        !isConfigSelectionComplete(values.selectedConfiguration)
      ) {
        form.setFieldTouched('selectedConfiguration', true, false);
        form.setFieldError('selectedConfiguration', 'Select a config');
        return;
      }

      if (visibility.showAuth && !values.selectedAuthConfigId) {
        form.setFieldTouched('selectedAuthConfigId', true, false);
        form.setFieldError('selectedAuthConfigId', 'Select an auth config');
        return;
      }

      await submitProviderSetup(values);
    },
    schema: yup =>
      yup.object({
        selectedProviderId: yup.string().required(),
        selectedConfiguration: yup.mixed<ConfigurationSelection>().defined(),
        selectedAuthConfigId: yup.string().optional().default(''),
        toolFilterMode: yup.mixed<'all' | 'select'>().oneOf(['all', 'select']).required(),
        selectedToolKeys: yup.array().of(yup.string().required()).defined()
      })
  });

  let shouldAutoCreateWithoutPanel =
    !isUpdate && !visibility.showConfig && !visibility.showAuth;
  let hasVisibleInputs = shouldAutoCreateWithoutPanel
    ? false
    : visibility.showConfig || visibility.showAuth || visibility.showToolFilters;
  let canSubmit =
    (visibility.configRequirement !== 'required' ||
      isConfigSelectionComplete(form.values.selectedConfiguration)) &&
    (!visibility.showAuth || Boolean(form.values.selectedAuthConfigId));
  let isSaving = setProvider.isPending || createConfig.isLoading;

  useEffect(() => {
    // Update flows must always show the panel so the user can change settings;
    // never silently submit on their behalf.
    if (isUpdate) return;
    if (visibility.isLoading || hasVisibleInputs || isSaving) return;
    if (
      visibility.configRequirement === 'required' &&
      !isConfigSelectionComplete(form.values.selectedConfiguration)
    )
      return;
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
              <form noValidate onSubmit={form.handleSubmit}>
                <ProviderSetupSections
                  instanceId={instance.data!.id}
                  providerId={providerId}
                  providerDeploymentId={p.integrationProvider.deployment.id}
                  fixedAuthMethodId={p.integrationProvider.authMethod?.id}
                  fixedAuthCredentialsId={p.integrationProvider.authCredentials?.id}
                  providerName={visibility.providerName}
                  selectedConfiguration={form.values.selectedConfiguration}
                  onSelectedConfigurationChange={value => {
                    form.setFieldValue('selectedConfiguration', value);
                    form.setFieldTouched('selectedConfiguration', false, false);
                    form.setFieldError('selectedConfiguration', undefined);
                  }}
                  selectedAuthConfigId={form.values.selectedAuthConfigId}
                  onSelectedAuthConfigIdChange={value => {
                    form.setFieldValue('selectedAuthConfigId', value);
                    form.setFieldTouched('selectedAuthConfigId', false, false);
                    form.setFieldError('selectedAuthConfigId', undefined);
                  }}
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
                  configRequirement={visibility.configRequirement}
                  authRequirement={visibility.showAuth ? 'required' : 'optional'}
                  configError={<form.RenderError field="selectedConfiguration" />}
                  authError={<form.RenderError field="selectedAuthConfigId" />}
                  supplementaryContent={
                    <>
                      {visibility.mustRequestInstanceConfig ? (
                        <Callout color="gray">
                          This integration provider has no config attached. Select or create a
                          config for this instance.
                        </Callout>
                      ) : null}
                      <setProvider.RenderError />
                      <createConfig.RenderError />
                    </>
                  }
                  footer={
                    <Dialog.Actions>
                      <Button type="button" variant="outline" onClick={p.close}>
                        Cancel
                      </Button>
                      <Button
                        type="button"
                        disabled={!canSubmit}
                        loading={isSaving}
                        onClick={() => {
                          void form.submitForm();
                        }}
                      >
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
