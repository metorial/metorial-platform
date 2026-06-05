import { useForm } from '@metorial/data-hooks';
import {
  useCreateProviderConfig,
  useCreateSessionTemplateProvider,
  useDeleteSessionTemplateProvider,
  useProvider,
  useProviderAuthConfig,
  useProviderAuthConfigs,
  useProviderListing,
  useProviderTools
} from '@metorial/state';
import {
  Avatar,
  Badge,
  Button,
  Callout,
  CenteredSpinner,
  Checkbox,
  Combobox,
  Dialog,
  Entity,
  Flex,
  OptionToggle,
  Text,
  theme
} from '@metorial/ui';
import { RiAddLine, RiArrowDownSLine, RiCheckLine } from '@remixicon/react';
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { TableFilterState } from '../../../../components/table/filter';
import {
  emptyConfigurationSelection,
  type ConfigurationSelection
} from '../../lib/configSelection';
import { ProviderAuthConfigCreateButton } from '../providerAuthConfigs/modal';
import { ProviderConfigurationSelection } from '../providerConfigs/selection';
import {
  ProviderCreationPanelShell,
  showProviderCreationPanel
} from '../providerCreationPanel';
import {
  FlatCreateSection,
  FlatCreateSections
} from '../providerCreationPanel/flatCreateLayout';
import { ProviderListingFilters, useProviderListingFilters } from '../providers/filters';
import { ProvidersWithDeploymentsSearch } from '../providers/search';

type AddProviderPanelFormValues = {
  selectedProviderId: string;
  selectedProviderName: string;
  selectedProviderDescription: string;
  selectedDeploymentId: string;
  selectedConfiguration: ConfigurationSelection;
  selectedAuthConfigId: string;
  toolFilterMode: 'all' | 'select';
  selectedToolKeys: string[];
};

type ToolPermissionMode = 'allow' | 'reject' | 'mixed';
type InitialToolFilter =
  | {
      type: 'allow_all';
    }
  | {
      type: 'filter';
      filters: {
        type: string;
        keys?: string[];
      }[];
    }
  | null;

export type ProviderPanelSubmitInput = {
  providerId: string;
  providerName?: string;
  providerDescription?: string | null;
  providerDeploymentId?: string;
  providerConfigId?: string;
  providerConfigVaultId?: string;
  providerAuthConfigId?: string;
  toolFilters?:
    | {
        type: 'tool_keys';
        keys: string[];
      }
    | {
        type: 'tool_keys';
        keys: string[];
      }[];
};

type AddProviderPanelFlowProps = {
  close: () => void;
  setPanelWidth: (width: number) => void;
  instanceId: string;
  sessionTemplateId?: string;
  sessionTemplateProviderId?: string;
  excludeProviderIds?: string[];
  providerId?: string;
  hideProviderStep?: boolean;
  initialDeploymentId?: string;
  initialConfigId?: string;
  initialAuthConfigId?: string;
  initialToolFilter?: InitialToolFilter;
  filterAvailableResources?: boolean;
  title?: string;
  description?: string;
  action?: string;
  onSubmitProvider?: (
    input: ProviderPanelSubmitInput,
    currentProviderId?: string
  ) => Promise<{ error?: unknown; success?: boolean }>;
  onComplete: () => void;
};

export let AddProviderPanelFlow = (p: AddProviderPanelFlowProps) => {
  let createConfigMutation = useCreateProviderConfig();
  let createMutation = useCreateSessionTemplateProvider();
  let deleteMutation = useDeleteSessionTemplateProvider();
  let [isSubmitting, setIsSubmitting] = useState(false);
  let [submitError, setSubmitError] = useState<unknown>(null);
  let selectedProvider = useProvider(p.instanceId, p.providerId);
  let resolvedProviderName =
    selectedProvider.data?.name ?? selectedProvider.data?.slug ?? p.providerId ?? '';
  let resolvedProviderDescription = selectedProvider.data?.description ?? '';
  let selectedProviderRequiresConfig = selectedProvider.data?.type.config.status == 'enabled';
  let selectedProviderRequiresAuth = selectedProvider.data?.type.auth.status == 'enabled';
  let [step, setStep] = useState(p.hideProviderStep ? 0 : p.providerId ? 1 : 0);
  let toolFilterHydrationKeyRef = useRef<string | null>(null);
  let initialSelectedToolKeys =
    p.initialToolFilter?.type === 'filter'
      ? p.initialToolFilter.filters
          .filter(filter => filter.type === 'tool_keys' && Array.isArray(filter.keys))
          .flatMap(filter => filter.keys ?? [])
      : [];
  let initialToolFilterMode: 'all' | 'select' =
    p.initialToolFilter?.type === 'filter' ? 'select' : 'all';

  useEffect(() => {
    if (p.hideProviderStep || step === 1) {
      p.setPanelWidth(660);
      return;
    }

    p.setPanelWidth(1050);
  }, [step, p.setPanelWidth, p.hideProviderStep]);

  let form = useForm<AddProviderPanelFormValues, AddProviderPanelFormValues>({
    initialValues: {
      selectedProviderId: p.providerId ?? '',
      selectedProviderName: resolvedProviderName,
      selectedProviderDescription: resolvedProviderDescription,
      selectedDeploymentId: p.initialDeploymentId ?? '',
      selectedConfiguration: p.initialConfigId
        ? { kind: 'config', id: p.initialConfigId }
        : emptyConfigurationSelection(),
      selectedAuthConfigId: p.initialAuthConfigId ?? '',
      toolFilterMode: initialToolFilterMode,
      selectedToolKeys: initialSelectedToolKeys
    },
    onSubmit: async values => {
      setSubmitError(null);
      let fallbackProviderConfigId: string | undefined;
      let needsFallbackConfig =
        !values.selectedDeploymentId &&
        values.selectedConfiguration.kind === 'none' &&
        !values.selectedAuthConfigId;

      if (needsFallbackConfig) {
        let fallbackConfigName = `${values.selectedProviderName || 'Provider'} Config`;
        let [config, configError] = await createConfigMutation.mutate({
          instanceId: p.instanceId,
          providerId: values.selectedProviderId,
          name: fallbackConfigName,
          description: 'Automatically created for session template provider setup.',
          value: {}
        });

        if (!config || configError) {
          return { error: configError };
        }

        fallbackProviderConfigId = config.id;
      }

      let submitInput: ProviderPanelSubmitInput = {
        providerId: values.selectedProviderId,
        providerName: values.selectedProviderName,
        providerDescription: values.selectedProviderDescription || undefined,
        ...(values.selectedDeploymentId
          ? { providerDeploymentId: values.selectedDeploymentId }
          : {}),
        ...(values.selectedConfiguration.kind === 'config'
          ? {
              providerConfigId: values.selectedConfiguration.id
            }
          : {}),
        ...(fallbackProviderConfigId
          ? {
              providerConfigId: fallbackProviderConfigId
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
        toolFilters:
          values.toolFilterMode === 'select'
            ? {
                type: 'tool_keys' as const,
                keys: values.selectedToolKeys
              }
            : []
      };

      if (p.onSubmitProvider) {
        setIsSubmitting(true);
        let result = await p.onSubmitProvider(submitInput, p.sessionTemplateProviderId);
        setIsSubmitting(false);

        if (result.success && !result.error) {
          p.onComplete();
          p.close();
          return { success: true };
        }

        setSubmitError(result.error ?? null);
        return { error: result.error };
      }

      let createInput = {
        instanceId: p.instanceId,
        sessionTemplateId: p.sessionTemplateId!,
        ...submitInput
      };

      if (p.sessionTemplateProviderId && p.sessionTemplateId) {
        // Replace flow for "edit": create the new mapping first,
        // then remove the old row to avoid losing config on create failure.
        let [created, createError] = await createMutation.mutate(createInput);
        if (!created || createError) {
          return { error: createError };
        }

        let [, deleteError] = await deleteMutation.mutate({
          instanceId: p.instanceId,
          sessionTemplateId: p.sessionTemplateId,
          sessionTemplateProviderId: p.sessionTemplateProviderId
        });

        if (deleteError) {
          return { error: deleteError };
        }

        p.onComplete();
        p.close();
        return { success: true };
      }

      let [result, error] = await createMutation.mutate(createInput);

      if (result && !error) {
        p.onComplete();
        p.close();
        return { success: true };
      }

      return { error };
    },
    schema: yup =>
      yup.object({
        selectedProviderId: yup.string().defined(),
        selectedProviderName: yup.string().defined(),
        selectedProviderDescription: yup.string().optional().default(''),
        selectedDeploymentId: yup.string().optional().default(''),
        selectedConfiguration: yup.mixed<ConfigurationSelection>().defined(),
        selectedAuthConfigId: yup.string().optional().default(''),
        toolFilterMode: yup.mixed<'all' | 'select'>().oneOf(['all', 'select']).required(),
        selectedToolKeys: yup.array().of(yup.string().required()).defined()
      })
  });

  useEffect(() => {
    if (!p.providerId) return;

    if (form.values.selectedProviderId !== p.providerId) {
      form.setFieldValue('selectedProviderId', p.providerId);
    }

    if (resolvedProviderName && form.values.selectedProviderName !== resolvedProviderName) {
      form.setFieldValue('selectedProviderName', resolvedProviderName);
    }

    if (
      resolvedProviderDescription &&
      form.values.selectedProviderDescription !== resolvedProviderDescription
    ) {
      form.setFieldValue('selectedProviderDescription', resolvedProviderDescription);
    }
  }, [
    p.providerId,
    resolvedProviderName,
    resolvedProviderDescription,
    form.values.selectedProviderId,
    form.values.selectedProviderName,
    form.values.selectedProviderDescription
  ]);

  useEffect(() => {
    if (!p.hideProviderStep) return;

    if (p.providerId && !form.values.selectedProviderId) {
      form.setFieldValue('selectedProviderId', p.providerId);
    }

    if (resolvedProviderName && !form.values.selectedProviderName) {
      form.setFieldValue('selectedProviderName', resolvedProviderName);
    }

    if (resolvedProviderDescription && !form.values.selectedProviderDescription) {
      form.setFieldValue('selectedProviderDescription', resolvedProviderDescription);
    }

    if (p.initialDeploymentId && !form.values.selectedDeploymentId) {
      form.setFieldValue('selectedDeploymentId', p.initialDeploymentId);
    }

    if (
      p.initialConfigId &&
      selectedProviderRequiresConfig &&
      form.values.selectedConfiguration.kind === 'none'
    ) {
      form.setFieldValue('selectedConfiguration', { kind: 'config', id: p.initialConfigId });
    }

    if (
      p.initialAuthConfigId &&
      selectedProviderRequiresAuth &&
      !form.values.selectedAuthConfigId
    ) {
      form.setFieldValue('selectedAuthConfigId', p.initialAuthConfigId);
    }
  }, [
    p.hideProviderStep,
    p.providerId,
    p.initialDeploymentId,
    p.initialConfigId,
    p.initialAuthConfigId,
    selectedProviderRequiresConfig,
    selectedProviderRequiresAuth,
    resolvedProviderName,
    resolvedProviderDescription,
    form.values.selectedProviderId,
    form.values.selectedProviderName,
    form.values.selectedProviderDescription,
    form.values.selectedDeploymentId,
    form.values.selectedConfiguration.kind,
    form.values.selectedAuthConfigId
  ]);

  useEffect(() => {
    if (!p.hideProviderStep) {
      toolFilterHydrationKeyRef.current = null;
      return;
    }

    let hydrationKey = [
      p.sessionTemplateProviderId ?? '',
      p.providerId ?? '',
      initialToolFilterMode,
      ...initialSelectedToolKeys
    ].join('::');

    if (toolFilterHydrationKeyRef.current === hydrationKey) return;

    toolFilterHydrationKeyRef.current = hydrationKey;
    form.setFieldValue('toolFilterMode', initialToolFilterMode);
    form.setFieldValue('selectedToolKeys', initialSelectedToolKeys);
  }, [
    p.hideProviderStep,
    p.sessionTemplateProviderId,
    p.providerId,
    initialToolFilterMode,
    initialSelectedToolKeys,
    form
  ]);

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

  let resetDeploymentAndConfigurationState = () => {
    form.setFieldValue('selectedDeploymentId', '');
    form.setFieldTouched('selectedDeploymentId', false, false);
    form.setFieldError('selectedDeploymentId', undefined);
    resetConfigurationState();
  };

  let handleProviderSelect = (
    providerId: string,
    providerName: string,
    providerDescription?: string | null
  ) => {
    form.setFieldValue('selectedProviderId', providerId);
    form.setFieldValue('selectedProviderName', providerName);
    form.setFieldValue('selectedProviderDescription', providerDescription ?? '');
    resetDeploymentAndConfigurationState();
    setStep(1);
  };

  let steps = useMemo(() => {
    let configureStep = {
      title: 'Configure',
      render: () =>
        form.values.selectedProviderId ? (
          <form onSubmit={form.handleSubmit}>
            <ConfigureStep
              form={form}
              instanceId={p.instanceId}
              providerId={form.values.selectedProviderId}
              providerName={form.values.selectedProviderName}
              saving={
                createConfigMutation.isLoading ||
                isSubmitting ||
                createMutation.isPending ||
                deleteMutation.isPending
              }
              mutationError={
                <>
                  <createConfigMutation.RenderError />
                  <createMutation.RenderError />
                  <deleteMutation.RenderError />
                </>
              }
              submitLabel={p.action || 'Add Provider'}
              filterAvailableResources={p.filterAvailableResources}
              onBack={p.hideProviderStep ? p.close : () => setStep(0)}
            />
          </form>
        ) : (
          <CenteredSpinner />
        )
    };

    if (p.hideProviderStep) {
      return [configureStep];
    }

    return [
      {
        title: 'Select Provider',
        render: () => (
          <PickProviderStep
            instanceId={p.instanceId}
            excludeProviderIds={p.excludeProviderIds}
            selectedProviderId={form.values.selectedProviderId || undefined}
            onSelect={handleProviderSelect}
          />
        )
      },
      configureStep
    ];
  }, [
    form,
    p.instanceId,
    form.values.selectedProviderId,
    form.values.selectedProviderName,
    resolvedProviderName,
    createConfigMutation.isLoading,
    isSubmitting,
    submitError,
    createMutation.isPending,
    deleteMutation.isPending,
    form.handleSubmit,
    p.action,
    p.hideProviderStep,
    p.close
  ]);

  useEffect(() => {
    let errorCode = createMutation.error?.data?.code;
    let entityId = createMutation.error?.data?.entityId;
    if (errorCode !== 'use_after_delete' || !entityId) return;

    if (
      form.values.selectedConfiguration.kind !== 'none' &&
      entityId === form.values.selectedConfiguration.id
    ) {
      form.setFieldValue('selectedConfiguration', emptyConfigurationSelection());
      form.setFieldTouched('selectedConfiguration', true, false);
      form.setFieldError(
        'selectedConfiguration',
        form.values.selectedConfiguration.kind === 'vault'
          ? 'Selected config vault was deleted or archived. Choose another vault or leave Config empty.'
          : 'Selected provider config was deleted or archived. Choose another config or leave Config empty.'
      );
    }

    if (entityId === form.values.selectedAuthConfigId) {
      form.setFieldValue('selectedAuthConfigId', '');
      form.setFieldTouched('selectedAuthConfigId', true, false);
      form.setFieldError(
        'selectedAuthConfigId',
        'Selected auth config was deleted or archived. Choose another auth config or leave Auth Config empty.'
      );
    }
  }, [
    createMutation.error?.data?.code,
    createMutation.error?.data?.entityId,
    form,
    form.values.selectedAuthConfigId,
    form.values.selectedConfiguration
  ]);

  return (
    <ProviderCreationPanelShell
      title={p.title ?? 'Add Provider'}
      description={
        p.description ??
        (p.providerId
          ? 'Configure optional settings for this provider and add it to this template.'
          : 'Select a provider to add to this template.')
      }
      steps={steps}
      currentStep={p.hideProviderStep ? 0 : step}
      setCurrentStep={nextStep => {
        if (p.hideProviderStep) return;
        if (nextStep === 0) {
          setStep(0);
          return;
        }

        if (nextStep === 1 && form.values.selectedProviderId) {
          setStep(1);
        }
      }}
      hideStepper={p.hideProviderStep}
      isStepDisabled={nextStep => nextStep >= 1 && !form.values.selectedProviderId}
      getStepDisabledReason={nextStep => {
        if (nextStep >= 1 && !form.values.selectedProviderId) {
          return 'Select a provider first.';
        }
        return undefined;
      }}
    />
  );
};

let getToolAccessGroup = (
  tool: {
    tags?: {
      readOnly?: boolean | null;
      read_only?: boolean | null;
      destructive?: boolean | null;
    } | null;
  } & Record<string, unknown>
) => {
  if (tool.tags?.destructive) return 'destructive';
  if (tool.tags?.readOnly || tool.tags?.read_only) return 'read';
  return 'write';
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

type ProviderSetupSectionsProps = {
  instanceId: string;
  providerId: string;
  providerName: string;
  showProviderSummary?: boolean;
  defaultAuthConfigName?: string;
  providerDeploymentId?: string | null;
  fixedAuthMethodId?: string;
  fixedAuthCredentialsId?: string;
  selectedConfiguration: ConfigurationSelection;
  onSelectedConfigurationChange: (value: ConfigurationSelection) => void;
  selectedAuthConfigId: string;
  onSelectedAuthConfigIdChange: (value: string) => void;
  toolFilterMode?: 'all' | 'select';
  onToolFilterModeChange?: (value: 'all' | 'select') => void;
  selectedToolKeys?: string[];
  onSelectedToolKeysChange?: (keys: string[]) => void;
  configError?: ReactNode;
  authError?: ReactNode;
  showToolFilters?: boolean;
  showConfigSection?: boolean;
  showAuthSection?: boolean;
  /**
   * Render the config section even when `provider.data?.type.config.status`
   * isn't strictly `'enabled'`. Useful for providers that only ever take an
   * empty config but still accept a `configId` -- callers (e.g. the edit
   * provider flow) can opt in to surfacing the picker for those.
   */
  forceConfigSectionVisible?: boolean;
  configRequirement?: 'required' | 'optional';
  authRequirement?: 'required' | 'optional';
  showExistingConfigOptions?: boolean;
  showExistingAuthOptions?: boolean;
  filterAvailableResources?: boolean;
  autoStartManagedCredentialSetup?: boolean;
  emptyState?: ReactNode;
  supplementaryContent?: ReactNode;
  footer?: ReactNode;
  disabled?: boolean;
};

export let ProviderSetupSections = (p: ProviderSetupSectionsProps) => {
  let [sectionModeOverrides, setSectionModeOverrides] = useState<{
    read?: ToolPermissionMode;
    write?: ToolPermissionMode;
    destructive?: ToolPermissionMode;
  }>({});
  let [createdAuthConfigSelection, setCreatedAuthConfigSelection] = useState<{
    id: string;
    label: string;
  } | null>(null);
  let scrollContainerRef = useRef<HTMLDivElement | null>(null);
  let [scrollIndicators, setScrollIndicators] = useState({
    canScrollUp: false,
    canScrollDown: false,
    hasScrolled: false
  });
  let provider = useProvider(p.instanceId, p.providerId);
  let providerListing = useProviderListing(p.instanceId, p.providerId);
  let selectedAuthConfig = useProviderAuthConfig(p.instanceId, p.selectedAuthConfigId || null);
  let providerVersionId = provider.data?.currentVersion?.id ?? null;
  let showToolFilters = p.showToolFilters ?? true;
  let showConfigSection = p.showConfigSection ?? true;
  let showAuthSection = p.showAuthSection ?? true;
  let showProviderSummary = p.showProviderSummary ?? true;
  let configRequirement = p.configRequirement ?? 'required';
  let authRequirement = p.authRequirement ?? 'required';
  let showExistingConfigOptions = p.showExistingConfigOptions ?? true;
  let showExistingAuthOptions = p.showExistingAuthOptions ?? true;
  let filterAvailableResources = p.filterAvailableResources ?? false;
  let autoStartManagedCredentialSetup = p.autoStartManagedCredentialSetup ?? false;
  let tools = useProviderTools(
    p.instanceId,
    showToolFilters && providerVersionId ? { providerVersionId } : null
  );
  let toolItems = tools.data?.items ?? [];
  let requiresProviderConfig =
    showConfigSection &&
    (p.forceConfigSectionVisible || provider.data?.type.config.status == 'enabled');
  let normalizedTools = toolItems.map(tool => ({
    key: tool.key ?? tool.name,
    name: tool.name,
    description: tool.description ?? null,
    group: getToolAccessGroup(
      tool as { name: string; description?: string | null } & Record<string, unknown>
    )
  }));
  let readOnlyTools = normalizedTools.filter(tool => tool.group === 'read');
  let writeTools = normalizedTools.filter(tool => tool.group === 'write');
  let destructiveTools = normalizedTools.filter(tool => tool.group === 'destructive');
  let requiresAuthConfig = showAuthSection && provider.data?.type.auth.status == 'enabled';
  let pendingCreatedAuthConfigIdRef = useRef<string | null>(null);
  let selectedToolKeys = p.selectedToolKeys ?? [];
  let toolFilterMode = p.toolFilterMode ?? 'all';

  useEffect(() => {
    if (provider.isLoading || requiresProviderConfig) return;
    if (p.selectedConfiguration.kind === 'none') return;

    p.onSelectedConfigurationChange(emptyConfigurationSelection());
  }, [
    provider.isLoading,
    requiresProviderConfig,
    p.selectedConfiguration.kind,
    p.onSelectedConfigurationChange
  ]);

  useEffect(() => {
    if (provider.isLoading || requiresAuthConfig) return;
    if (!p.selectedAuthConfigId) return;

    p.onSelectedAuthConfigIdChange('');
  }, [
    provider.isLoading,
    requiresAuthConfig,
    p.selectedAuthConfigId,
    p.onSelectedAuthConfigIdChange
  ]);

  useEffect(() => {
    if (!p.selectedAuthConfigId || selectedAuthConfig.isLoading) return;

    if (pendingCreatedAuthConfigIdRef.current === p.selectedAuthConfigId) {
      if (selectedAuthConfig.data?.id === p.selectedAuthConfigId) {
        pendingCreatedAuthConfigIdRef.current = null;
      }
      return;
    }

    if (selectedAuthConfig.error || !selectedAuthConfig.data) {
      p.onSelectedAuthConfigIdChange('');
    }
  }, [
    p.selectedAuthConfigId,
    p.onSelectedAuthConfigIdChange,
    selectedAuthConfig.isLoading,
    selectedAuthConfig.data,
    selectedAuthConfig.error
  ]);

  useEffect(() => {
    if (!createdAuthConfigSelection) return;
    if (createdAuthConfigSelection.id !== p.selectedAuthConfigId) {
      setCreatedAuthConfigSelection(null);
    }
  }, [createdAuthConfigSelection, p.selectedAuthConfigId]);

  useEffect(() => {
    if (!showToolFilters || toolItems.length === 0) return;
    if (!p.onSelectedToolKeysChange || !p.onToolFilterModeChange) return;
    if (toolFilterMode !== 'all') return;

    let allToolKeys = toolItems.map(tool => tool.key ?? tool.name);
    let selectedSet = new Set(selectedToolKeys);
    let alreadyAllSelected =
      allToolKeys.length > 0 &&
      allToolKeys.every(key => selectedSet.has(key)) &&
      selectedSet.size === allToolKeys.length;

    if (!alreadyAllSelected) {
      p.onSelectedToolKeysChange(allToolKeys);
    }
  }, [
    showToolFilters,
    p.onSelectedToolKeysChange,
    p.onToolFilterModeChange,
    selectedToolKeys,
    toolFilterMode,
    toolItems
  ]);

  useEffect(() => {
    let container = scrollContainerRef.current;
    if (!container) return;

    let updateIndicators = () => {
      let { scrollTop, scrollHeight, clientHeight } = container;
      let maxScrollTop = Math.max(0, scrollHeight - clientHeight);

      setScrollIndicators({
        canScrollUp: scrollTop > 8,
        canScrollDown: scrollTop < maxScrollTop - 8,
        hasScrolled: scrollTop > 8
      });
    };

    updateIndicators();
    container.addEventListener('scroll', updateIndicators);
    window.addEventListener('resize', updateIndicators);

    return () => {
      container.removeEventListener('scroll', updateIndicators);
      window.removeEventListener('resize', updateIndicators);
    };
  }, [requiresProviderConfig, requiresAuthConfig, showToolFilters, toolItems.length]);

  if (provider.isLoading || (showToolFilters && !!providerVersionId && tools.isLoading)) {
    return <CenteredSpinner />;
  }

  let sectionItems: ReactNode[] = [];
  let isConfigCompleted = p.selectedConfiguration.kind !== 'none';
  let isAuthCompleted = Boolean(p.selectedAuthConfigId);
  let isToolsCompleted = toolFilterMode === 'all' || toolFilterMode === 'select';
  let providerDisplayName =
    providerListing.data?.name ??
    provider.data?.name ??
    p.providerName ??
    provider.data?.slug ??
    'Provider';
  let createAuthConfigLabel = requiresProviderConfig
    ? 'Create Auth Config'
    : `Log in with ${providerDisplayName}`;
  let providerImageUrl = providerListing.data?.imageUrl;

  if (showProviderSummary) {
    sectionItems.push(
      <Entity.Wrapper key="provider-summary">
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
  }

  if (requiresProviderConfig) {
    sectionItems.push(
      <ConfigureSectionCard
        key="config"
        title="Config"
        description="Choose the provider configuration or vault this setup should use."
        requirement={configRequirement}
        completed={isConfigCompleted}
      >
        <div>
          <ProviderConfigurationSelection
            instanceId={p.instanceId}
            providerId={p.providerId}
            providerDeploymentId={p.providerDeploymentId ?? undefined}
            value={p.selectedConfiguration}
            onChange={p.onSelectedConfigurationChange}
            label="Config"
            includeVaults
            createConfigButtonLabel="Create Config"
            showExistingOptions={showExistingConfigOptions}
            filterAvailableResources={filterAvailableResources}
            disabled={p.disabled}
          />
          {p.configError}
        </div>
      </ConfigureSectionCard>
    );
  }

  if (requiresAuthConfig) {
    sectionItems.push(
      <ConfigureSectionCard
        key="auth"
        title="Auth Config"
        description="Select the authentication settings this setup should use when it connects to the provider."
        requirement={authRequirement}
        completed={isAuthCompleted}
      >
        <div>
          {createdAuthConfigSelection ? (
            <Flex justify="space-between" align="center" gap={12} wrap="wrap">
              <Text size="2">
                New auth config selected: <strong>{createdAuthConfigSelection.label}</strong>
              </Text>
              <Button
                type="button"
                size="2"
                variant="outline"
                disabled={p.disabled}
                onClick={() => setCreatedAuthConfigSelection(null)}
              >
                Choose another
              </Button>
            </Flex>
          ) : (
            <Flex gap={8} align="end">
              {showExistingAuthOptions ? (
                <div style={{ flex: 1 }}>
                  <Combobox
                    label="Auth Config"
                    placeholder="Search auth configs"
                    value={p.selectedAuthConfigId || null}
                    valueLabel={selectedAuthConfig.data?.name ?? selectedAuthConfig.data?.id}
                    disabled={p.disabled}
                    provider={({ searchQuery }) => {
                      let comboboxAuthConfigs = useProviderAuthConfigs(p.instanceId, {
                        providerId: p.providerId,
                        limit: 25,
                        search: searchQuery || undefined,
                        ...(filterAvailableResources
                          ? {
                              availableForUse: true,
                              availableForProviderDeploymentId:
                                p.providerDeploymentId ?? undefined
                            }
                          : {
                              providerDeploymentId: p.providerDeploymentId ?? undefined
                            }),
                        providerAuthMethodId: p.fixedAuthMethodId ?? undefined
                      });

                      return {
                        items: (comboboxAuthConfigs.data?.items ?? []).map(config => ({
                          id: config.id,
                          label: config.name ?? config.id
                        })),
                        isLoading: comboboxAuthConfigs.isLoading,
                        empty: searchQuery
                          ? 'No matching auth configs found.'
                          : 'No auth configs available.'
                      };
                    }}
                    onChange={value => {
                      p.onSelectedAuthConfigIdChange(value ?? '');
                    }}
                  />
                </div>
              ) : null}

              <ProviderAuthConfigCreateButton
                instanceId={p.instanceId}
                providerDeploymentId={p.providerDeploymentId ?? undefined}
                providerId={p.providerId}
                fixedAuthMethodId={p.fixedAuthMethodId}
                fixedAuthCredentialsId={p.fixedAuthCredentialsId}
                defaultAuthConfigName={p.defaultAuthConfigName}
                autoStartManagedCredentialSetup={autoStartManagedCredentialSetup}
                onCreate={async authConfig => {
                  pendingCreatedAuthConfigIdRef.current = authConfig.id;
                  setCreatedAuthConfigSelection({
                    id: authConfig.id,
                    label: authConfig.name ?? authConfig.id
                  });
                  p.onSelectedAuthConfigIdChange(authConfig.id);
                }}
                size="3"
                iconLeft={<RiAddLine />}
                ariaLabel={createAuthConfigLabel}
                disabled={p.disabled}
              >
                {createAuthConfigLabel}
              </ProviderAuthConfigCreateButton>
            </Flex>
          )}

          {p.authError}
        </div>
      </ConfigureSectionCard>
    );
  }

  if (
    showToolFilters &&
    toolItems.length > 0 &&
    p.onSelectedToolKeysChange &&
    p.onToolFilterModeChange
  ) {
    let selectedKeys = new Set(selectedToolKeys);
    let allToolKeys = normalizedTools.map(tool => tool.key);
    let allToolKeySet = new Set(allToolKeys);
    let readOnlyToolKeySet = new Set(readOnlyTools.map(tool => tool.key));
    let writeToolKeySet = new Set(writeTools.map(tool => tool.key));
    let destructiveToolKeySet = new Set(destructiveTools.map(tool => tool.key));
    let updateSelectedToolKeys = (nextKeys: string[]) => {
      p.onSelectedToolKeysChange?.(nextKeys);
    };
    let setToolChecked = (toolKey: string, checked: boolean) => {
      setSectionModeOverrides(prev => ({
        ...prev,
        ...(readOnlyToolKeySet.has(toolKey) ? { read: undefined } : {}),
        ...(writeToolKeySet.has(toolKey) ? { write: undefined } : {}),
        ...(destructiveToolKeySet.has(toolKey) ? { destructive: undefined } : {})
      }));

      let nextKeys = checked
        ? [...new Set([...selectedToolKeys, toolKey])]
        : selectedToolKeys.filter(key => key !== toolKey);
      let isAllSelected =
        normalizedTools.length > 0 &&
        normalizedTools.every(tool => nextKeys.includes(tool.key)) &&
        nextKeys.length === allToolKeySet.size;

      p.onToolFilterModeChange?.(isAllSelected ? 'all' : 'select');
      updateSelectedToolKeys(nextKeys);
    };
    let getSectionMode = (sectionTools: { key: string }[]): ToolPermissionMode => {
      if (sectionTools.length === 0) return 'reject';
      let selectedCount = sectionTools.filter(tool => selectedKeys.has(tool.key)).length;
      if (selectedCount === 0) return 'reject';
      if (selectedCount === sectionTools.length) return 'allow';
      return 'mixed';
    };
    let getDisplayedSectionMode = (
      sectionId: 'read' | 'write' | 'destructive',
      sectionTools: { key: string }[]
    ): ToolPermissionMode => {
      return sectionModeOverrides[sectionId] ?? getSectionMode(sectionTools);
    };
    let setSectionMode = (
      sectionId: 'read' | 'write' | 'destructive',
      sectionTools: { key: string }[],
      mode: ToolPermissionMode
    ) => {
      if (sectionTools.length === 0) return;
      if (mode === 'mixed') {
        setSectionModeOverrides(prev => ({ ...prev, [sectionId]: 'mixed' }));
        return;
      }

      setSectionModeOverrides(prev => ({ ...prev, [sectionId]: undefined }));
      let sectionToolKeySet = new Set(sectionTools.map(tool => tool.key));
      if (mode === 'allow') {
        let nextKeys = [
          ...new Set([...selectedToolKeys, ...sectionTools.map(tool => tool.key)])
        ];
        let isAllSelected =
          normalizedTools.length > 0 &&
          normalizedTools.every(tool => nextKeys.includes(tool.key)) &&
          nextKeys.length === allToolKeySet.size;
        p.onToolFilterModeChange?.(isAllSelected ? 'all' : 'select');
        updateSelectedToolKeys(nextKeys);
        return;
      }
      p.onToolFilterModeChange?.('select');
      updateSelectedToolKeys(selectedToolKeys.filter(key => !sectionToolKeySet.has(key)));
    };

    sectionItems.push(
      <ConfigureSectionCard
        key="tools"
        title="Tool Filters"
        description="Limit which tools this provider setup is allowed to use."
        requirement="optional"
        completed={isToolsCompleted}
      >
        <div
          style={{
            marginRight: -20,
            paddingRight: 20
          }}
        >
          <Flex direction="column" gap={12}>
            {[
              { id: 'read', title: 'Read-Only Tools', tools: readOnlyTools },
              { id: 'write', title: 'Write Tools', tools: writeTools },
              { id: 'destructive', title: 'Destructive Tools', tools: destructiveTools }
            ]
              .filter(section => section.tools.length > 0)
              .map(section => (
                <div
                  key={section.id}
                  style={{
                    padding: '6px 0 8px'
                  }}
                >
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'minmax(120px, 1fr) auto',
                      gap: 10,
                      alignItems: 'center'
                    }}
                  >
                    <Text size="2" style={{ fontWeight: 600, lineHeight: 1.2 }}>
                      {section.title} ({section.tools.length})
                    </Text>
                    <OptionToggle
                      size="1"
                      value={getDisplayedSectionMode(
                        section.id as 'read' | 'write' | 'destructive',
                        section.tools
                      )}
                      onChange={value => {
                        if (value !== 'allow' && value !== 'reject' && value !== 'mixed') {
                          return;
                        }
                        setSectionMode(
                          section.id as 'read' | 'write' | 'destructive',
                          section.tools,
                          value
                        );
                      }}
                      items={[
                        { id: 'allow', label: 'Allow' },
                        { id: 'reject', label: 'Reject' },
                        { id: 'mixed', label: 'Mixed' }
                      ]}
                    />
                  </div>

                  <Flex direction="column" gap={0} style={{ marginTop: 12 }}>
                    {section.tools.map((tool, idx) => (
                      <div
                        key={tool.key}
                        style={{
                          padding: '9px 2px',
                          borderBottom:
                            idx === section.tools.length - 1 ? 'none' : '1px solid #f1f1f1'
                        }}
                      >
                        <Checkbox
                          checked={selectedKeys.has(tool.key)}
                          onCheckedChange={checked => setToolChecked(tool.key, !!checked)}
                          label={tool.name}
                        />
                      </div>
                    ))}
                  </Flex>
                </div>
              ))}
          </Flex>
        </div>
      </ConfigureSectionCard>
    );
  }

  return (
    <Flex direction="column" gap={10} style={{ flex: 1, minHeight: 0 }}>
      {sectionItems.length > 0 ? (
        <div style={{ position: 'relative', flex: 1, minHeight: 0 }}>
          <div
            ref={scrollContainerRef}
            style={{
              height: '100%',
              minHeight: 0,
              overflowY: 'auto',
              paddingRight: 6
            }}
          >
            <FlatCreateSections>
              <Flex direction="column" gap={12}>
                {sectionItems}
              </Flex>
            </FlatCreateSections>
          </div>

          {scrollIndicators.canScrollUp ? (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 6,
                height: 28,
                background:
                  'linear-gradient(180deg, rgba(255, 255, 255, 0.98) 0%, rgba(255, 255, 255, 0) 100%)',
                pointerEvents: 'none'
              }}
            />
          ) : null}

          {scrollIndicators.canScrollDown ? (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
              style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 6,
                height: 44,
                display: 'flex',
                alignItems: 'end',
                justifyContent: 'center',
                background:
                  'linear-gradient(180deg, rgba(255, 255, 255, 0) 0%, rgba(255, 255, 255, 0.98) 100%)',
                pointerEvents: 'none'
              }}
            >
              {!scrollIndicators.hasScrolled ? (
                <motion.div
                  animate={{
                    y: [0, 4, 0],
                    opacity: [0.4, 0.82, 0.4]
                  }}
                  transition={{
                    duration: 1.6,
                    repeat: Infinity,
                    ease: 'easeInOut'
                  }}
                  style={{ display: 'inline-flex', marginBottom: 4 }}
                >
                  <RiArrowDownSLine size={20} />
                </motion.div>
              ) : null}
            </motion.div>
          ) : null}
        </div>
      ) : (
        (p.emptyState ?? null)
      )}

      {p.supplementaryContent}
      {p.footer}
    </Flex>
  );
};

let PickProviderStep = (p: {
  instanceId: string;
  excludeProviderIds?: string[];
  selectedProviderId?: string;
  onSelect: (
    providerId: string,
    providerName: string,
    providerDescription?: string | null
  ) => void;
}) => {
  let [search, setSearch] = useState('');
  let [filterState, setFilterState] = useState<TableFilterState[]>([]);
  let { filters, providerListingsFilter } = useProviderListingFilters({
    search,
    filterState
  });

  return (
    <Flex direction="column" gap={15}>
      <ProviderListingFilters
        searchState={[search, setSearch]}
        filterState={[filterState, setFilterState]}
        filters={filters}
      />

      <ProvidersWithDeploymentsSearch
        instanceId={p.instanceId}
        columns={3}
        limit={30}
        variant="providerCard"
        cardSize="compact"
        includeAllProviders
        prioritizeProvidersWithDeployments
        providerListingsFilter={providerListingsFilter}
        excludeProviderIds={p.excludeProviderIds}
        hideSearch
        internalScroll
        internalScrollHeight="calc(100vh - 360px)"
        emptyText="No providers found."
        selectedProviderId={p.selectedProviderId}
        onSelect={provider => {
          requestAnimationFrame(() => {
            p.onSelect(
              provider.id,
              provider.name ?? provider.slug ?? 'Provider',
              provider.description
            );
          });
        }}
      />
    </Flex>
  );
};

let ConfigureStep = (p: {
  form: ReturnType<typeof useForm<AddProviderPanelFormValues, AddProviderPanelFormValues>>;
  instanceId: string;
  providerId: string;
  providerName: string;
  saving: boolean;
  mutationError: ReactNode;
  submitLabel: string;
  filterAvailableResources?: boolean;
  onBack: () => void;
}) => {
  let provider = useProvider(p.instanceId, p.providerId);
  let requiresProviderConfig = provider.data?.type.config.status == 'enabled';
  let requiresAuthConfig = provider.data?.type.auth.status == 'enabled';
  let validateRequiredSelections = () => {
    let isValid = true;

    if (requiresProviderConfig && p.form.values.selectedConfiguration.kind === 'none') {
      p.form.setFieldTouched('selectedConfiguration', true, false);
      p.form.setFieldError('selectedConfiguration', 'Select a config or config vault');
      isValid = false;
    }

    if (requiresAuthConfig && !p.form.values.selectedAuthConfigId) {
      p.form.setFieldTouched('selectedAuthConfigId', true, false);
      p.form.setFieldError('selectedAuthConfigId', 'Select an auth config');
      isValid = false;
    }

    return isValid;
  };

  let canSubmit =
    (!requiresProviderConfig || p.form.values.selectedConfiguration.kind !== 'none') &&
    (!requiresAuthConfig || Boolean(p.form.values.selectedAuthConfigId));

  let handleSubmitClick = async () => {
    if (!canSubmit) return;

    if (!validateRequiredSelections()) return;
    await p.form.submitForm();
  };

  return (
    <ProviderSetupSections
      instanceId={p.instanceId}
      providerId={p.providerId}
      providerName={p.providerName}
      providerDeploymentId={p.form.values.selectedDeploymentId || undefined}
      filterAvailableResources={p.filterAvailableResources}
      selectedConfiguration={p.form.values.selectedConfiguration}
      onSelectedConfigurationChange={value => {
        p.form.setFieldValue('selectedConfiguration', value);
        p.form.setFieldTouched('selectedConfiguration', false, false);
        p.form.setFieldError('selectedConfiguration', undefined);
      }}
      selectedAuthConfigId={p.form.values.selectedAuthConfigId}
      onSelectedAuthConfigIdChange={value => {
        p.form.setFieldValue('selectedAuthConfigId', value);
        p.form.setFieldTouched('selectedAuthConfigId', false, false);
        p.form.setFieldError('selectedAuthConfigId', undefined);
      }}
      toolFilterMode={p.form.values.toolFilterMode}
      onToolFilterModeChange={value => {
        p.form.setFieldValue('toolFilterMode', value);
      }}
      selectedToolKeys={p.form.values.selectedToolKeys}
      onSelectedToolKeysChange={keys => {
        p.form.setFieldValue('selectedToolKeys', keys);
        p.form.setFieldTouched('selectedToolKeys', false, false);
        p.form.setFieldError('selectedToolKeys', undefined);
      }}
      configError={<p.form.RenderError field="selectedConfiguration" />}
      authError={<p.form.RenderError field="selectedAuthConfigId" />}
      emptyState={
        <Callout color="gray">
          This provider does not require a config or auth config, and it has no tool filters to
          adjust before it is added to the template.
        </Callout>
      }
      supplementaryContent={p.mutationError}
      footer={
        <Dialog.Actions>
          <Button type="button" variant="outline" onClick={p.onBack}>
            Back
          </Button>
          <Button
            type="button"
            disabled={!canSubmit}
            loading={p.saving}
            onClick={handleSubmitClick}
          >
            {p.submitLabel}
          </Button>
        </Dialog.Actions>
      }
    />
  );
};

export let showAddProviderPanelFlow = (p: {
  instanceId: string;
  sessionTemplateId?: string;
  onComplete: () => void;
  sessionTemplateProviderId?: string;
  excludeProviderIds?: string[];
  providerId?: string;
  hideProviderStep?: boolean;
  initialDeploymentId?: string;
  initialConfigId?: string;
  initialAuthConfigId?: string;
  initialToolFilter?: InitialToolFilter;
  filterAvailableResources?: boolean;
  title?: string;
  description?: string;
  action?: string;
  onSubmitProvider?: (
    input: ProviderPanelSubmitInput,
    currentProviderId?: string
  ) => Promise<{ error?: unknown; success?: boolean }>;
}) =>
  showProviderCreationPanel(({ close, setWidth }) => (
    <AddProviderPanelFlow
      close={close}
      setPanelWidth={setWidth}
      instanceId={p.instanceId}
      sessionTemplateId={p.sessionTemplateId}
      sessionTemplateProviderId={p.sessionTemplateProviderId}
      excludeProviderIds={p.excludeProviderIds}
      providerId={p.providerId}
      hideProviderStep={p.hideProviderStep}
      initialDeploymentId={p.initialDeploymentId}
      initialConfigId={p.initialConfigId}
      initialAuthConfigId={p.initialAuthConfigId}
      initialToolFilter={p.initialToolFilter}
      filterAvailableResources={p.filterAvailableResources}
      title={p.title}
      description={p.description}
      action={p.action}
      onSubmitProvider={p.onSubmitProvider}
      onComplete={p.onComplete}
    />
  ));
