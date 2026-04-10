import { useForm } from '@metorial/data-hooks';
import {
  useCreateSessionTemplateProvider,
  useDeleteSessionTemplateProvider,
  useProvider,
  useProviderAuthConfigs,
  useProviderTools
} from '@metorial/state';
import {
  Button,
  CenteredSpinner,
  Checkbox,
  Dialog,
  Flex,
  OptionToggle,
  Select,
  Text
} from '@metorial/ui';
import { RiAddLine } from '@remixicon/react';
import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { TableFilterState } from '../../../../components/table/filter';
import { SessionTemplateStepAccordion } from './stepAccordion';
import {
  emptyConfigurationSelection,
  type ConfigurationSelection
} from '../../lib/configSelection';
import {
  ProviderCreationPanelShell,
  showProviderCreationPanel
} from '../providerCreationPanel';
import { ProviderAuthConfigCreateButton } from '../providerAuthConfigs/modal';
import { ProviderListingFilters, useProviderListingFilters } from '../providers/filters';
import { ProviderConfigurationSelection } from '../providerConfigs/selection';
import { ProvidersWithDeploymentsSearch } from '../providers/search';

type AddProviderPanelFormValues = {
  selectedProviderId: string;
  selectedProviderName: string;
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

type AddProviderPanelFlowProps = {
  close: () => void;
  setPanelWidth: (width: number) => void;
  instanceId: string;
  sessionTemplateId: string;
  sessionTemplateProviderId?: string;
  providerId?: string;
  hideProviderStep?: boolean;
  initialDeploymentId?: string;
  initialConfigId?: string;
  initialAuthConfigId?: string;
  initialToolFilter?: InitialToolFilter;
  title?: string;
  description?: string;
  action?: string;
  onComplete: () => void;
};

let AddProviderPanelFlow = (p: AddProviderPanelFlowProps) => {
  let createMutation = useCreateSessionTemplateProvider();
  let deleteMutation = useDeleteSessionTemplateProvider();
  let selectedProvider = useProvider(p.instanceId, p.providerId);
  let resolvedProviderName =
    selectedProvider.data?.name ?? selectedProvider.data?.slug ?? p.providerId ?? '';
  let [step, setStep] = useState(p.hideProviderStep ? 0 : p.providerId ? 1 : 0);
  let initialSelectedToolKeys =
    p.initialToolFilter?.type === 'filter'
      ? p.initialToolFilter.filters
          .filter(filter => filter.type === 'tool_keys' && Array.isArray(filter.keys))
          .flatMap(filter => filter.keys ?? [])
      : [];
  let initialToolFilterMode: 'all' | 'select' =
    p.initialToolFilter?.type === 'filter' && initialSelectedToolKeys.length > 0
      ? 'select'
      : 'all';

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
      selectedDeploymentId: '',
      selectedConfiguration: p.initialConfigId
        ? { kind: 'config', id: p.initialConfigId }
        : emptyConfigurationSelection(),
      selectedAuthConfigId: p.initialAuthConfigId ?? '',
      toolFilterMode: initialToolFilterMode,
      selectedToolKeys: initialSelectedToolKeys
    },
    onSubmit: async values => {
      let createInput = {
        instanceId: p.instanceId,
        sessionTemplateId: p.sessionTemplateId,
        ...(values.selectedDeploymentId
          ? { providerDeploymentId: values.selectedDeploymentId }
          : {}),
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
        ...(values.toolFilterMode === 'select'
          ? {
              toolFilters: {
                type: 'tool_keys' as const,
                keys: values.selectedToolKeys
              }
            }
          : {})
      };

      if (p.sessionTemplateProviderId) {
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
  }, [
    p.providerId,
    resolvedProviderName,
    form.values.selectedProviderId,
    form.values.selectedProviderName
  ]);

  useEffect(() => {
    if (!p.hideProviderStep) return;

    if (p.providerId && !form.values.selectedProviderId) {
      form.setFieldValue('selectedProviderId', p.providerId);
    }

    if (resolvedProviderName && !form.values.selectedProviderName) {
      form.setFieldValue('selectedProviderName', resolvedProviderName);
    }

    if (p.initialConfigId && form.values.selectedConfiguration.kind === 'none') {
      form.setFieldValue('selectedConfiguration', { kind: 'config', id: p.initialConfigId });
    }

    if (p.initialAuthConfigId && !form.values.selectedAuthConfigId) {
      form.setFieldValue('selectedAuthConfigId', p.initialAuthConfigId);
    }

    if (initialToolFilterMode === 'select' && form.values.selectedToolKeys.length === 0) {
      form.setFieldValue('toolFilterMode', 'select');
      form.setFieldValue('selectedToolKeys', initialSelectedToolKeys);
    }
  }, [
    p.hideProviderStep,
    p.providerId,
    p.initialConfigId,
    p.initialAuthConfigId,
    resolvedProviderName,
    initialToolFilterMode,
    initialSelectedToolKeys,
    form.values.selectedProviderId,
    form.values.selectedProviderName,
    form.values.selectedConfiguration.kind,
    form.values.selectedAuthConfigId,
    form.values.selectedToolKeys.length
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

  let handleProviderSelect = (providerId: string, providerName: string) => {
    form.setFieldValue('selectedProviderId', providerId);
    form.setFieldValue('selectedProviderName', providerName);
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
              saving={createMutation.isPending || deleteMutation.isPending}
              mutationError={
                <>
                  <createMutation.RenderError />
                  <deleteMutation.RenderError />
                </>
              }
              submitLabel={p.action || 'Add Provider'}
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
          <PickProviderStep instanceId={p.instanceId} onSelect={handleProviderSelect} />
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
  if (tool.tags?.readOnly || tool.tags?.read_only) return 'read';
  return 'write';
};

let PickProviderStep = (p: {
  instanceId: string;
  onSelect: (providerId: string, providerName: string) => void;
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
        hideSearch
        internalScroll
        internalScrollHeight="calc(100vh - 360px)"
        emptyText="No providers found."
        onSelect={provider =>
          p.onSelect(provider.id, provider.name ?? provider.slug ?? 'Provider')
        }
      />
    </Flex>
  );
};

let ConfigureStep = (p: {
  form: ReturnType<typeof useForm<AddProviderPanelFormValues, AddProviderPanelFormValues>>;
  instanceId: string;
  providerId: string;
  saving: boolean;
  mutationError: ReactNode;
  submitLabel: string;
  onBack: () => void;
}) => {
  let [currentAccordionIndex, setCurrentAccordionIndex] = useState(0);
  let [maxCompletedAccordionIndex, setMaxCompletedAccordionIndex] = useState(0);
  let [isAccordionCollapsed, setIsAccordionCollapsed] = useState(false);
  let [sectionModeOverrides, setSectionModeOverrides] = useState<{
    read?: ToolPermissionMode;
    write?: ToolPermissionMode;
  }>({});
  let selectedDeploymentId = p.form.values.selectedDeploymentId || undefined;

  let authConfigs = useProviderAuthConfigs(p.instanceId, {
    providerId: p.providerId
  });
  let provider = useProvider(p.instanceId, p.providerId);
  let providerVersionId = provider.data?.currentVersion?.id ?? null;
  let tools = useProviderTools(p.instanceId, providerVersionId ? { providerVersionId } : null);
  let authConfigItems = authConfigs.data?.items ?? [];
  let toolItems = tools.data?.items ?? [];
  let normalizedTools = toolItems.map(tool => ({
    key: tool.key ?? tool.name,
    name: tool.name,
    description: tool.description ?? null,
    group: getToolAccessGroup(
      tool as { name: string; description?: string | null } & Record<string, unknown>
    )
  }));
  let readOnlyTools = normalizedTools.filter(tool => tool.group === 'read');
  let writeDeleteTools = normalizedTools.filter(tool => tool.group === 'write');
  let selectedAuthConfigId = p.form.values.selectedAuthConfigId;
  let requiresAuthConfig = provider.data?.type.auth.status == 'enabled';
  let pendingCreatedAuthConfigIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (authConfigs.isLoading || !selectedAuthConfigId) return;

    if (pendingCreatedAuthConfigIdRef.current === selectedAuthConfigId) {
      if (authConfigItems.some(item => item.id === selectedAuthConfigId)) {
        pendingCreatedAuthConfigIdRef.current = null;
      }
      return;
    }

    if (!authConfigItems.some(item => item.id === selectedAuthConfigId)) {
      p.form.setFieldValue('selectedAuthConfigId', '');
      p.form.setFieldTouched('selectedAuthConfigId', false, false);
      p.form.setFieldError('selectedAuthConfigId', undefined);
    }
  }, [authConfigs.isLoading, authConfigItems, p.form, selectedAuthConfigId]);

  useEffect(() => {
    if (toolItems.length === 0) return;
    if (p.form.values.toolFilterMode !== 'all') return;

    let allToolKeys = toolItems.map(tool => tool.key ?? tool.name);
    let selectedSet = new Set(p.form.values.selectedToolKeys);
    let alreadyAllSelected =
      allToolKeys.length > 0 &&
      allToolKeys.every(key => selectedSet.has(key)) &&
      selectedSet.size === allToolKeys.length;

    if (!alreadyAllSelected) {
      p.form.setFieldValue('selectedToolKeys', allToolKeys);
    }
  }, [p.form, p.form.values.selectedToolKeys, p.form.values.toolFilterMode, toolItems]);

  if (
    authConfigs.isLoading ||
    provider.isLoading ||
    (!!providerVersionId && tools.isLoading)
  ) {
    return <CenteredSpinner />;
  }

  let accordionItems: {
    id: 'config' | 'auth' | 'tools';
    title: ReactNode;
    description?: ReactNode;
    content: ReactNode;
    defaultOpen?: boolean;
  }[] = [
    {
      id: 'config',
      title: '1. Config',
      description: 'Choose the provider configuration or vault this template should use.',
      content: (
        <div style={{ maxHeight: 260, overflowY: 'auto' }}>
          <ProviderConfigurationSelection
            instanceId={p.instanceId}
            providerId={p.providerId}
            providerDeploymentId={selectedDeploymentId}
            value={p.form.values.selectedConfiguration}
            onChange={value => {
              p.form.setFieldValue('selectedConfiguration', value);
              p.form.setFieldTouched('selectedConfiguration', false, false);
              p.form.setFieldError('selectedConfiguration', undefined);
            }}
            label="Config"
            includeVaults
            createConfigButtonLabel="Create Config"
          />
          <p.form.RenderError field="selectedConfiguration" />
        </div>
      )
    }
  ];

  if (provider.data?.type.auth.status == 'enabled') {
    accordionItems.push({
      id: 'auth',
      title: '2. Auth Config',
      description: 'Select authentication settings for this provider in the template.',
      content: (
        <div style={{ maxHeight: 240, overflowY: 'auto' }}>
          <Flex gap={8} align="end">
            <div style={{ flex: 1 }}>
              <Select
                label="Auth Config"
                value={p.form.values.selectedAuthConfigId || '__placeholder__'}
                placeholder="Select an auth config..."
                onChange={v => {
                  p.form.setFieldValue(
                    'selectedAuthConfigId',
                    v === '__placeholder__' ? '' : v
                  );
                  p.form.setFieldTouched('selectedAuthConfigId', false, false);
                  p.form.setFieldError('selectedAuthConfigId', undefined);
                }}
                items={[
                  {
                    id: '__placeholder__',
                    label: 'Select an auth config...'
                  },
                  ...authConfigItems.map(config => ({
                    id: config.id,
                    label: config.name ?? config.id
                  }))
                ]}
              />
            </div>

            <ProviderAuthConfigCreateButton
              instanceId={p.instanceId}
              providerDeploymentId={selectedDeploymentId}
              providerId={p.providerId}
              onCreate={async authConfig => {
                pendingCreatedAuthConfigIdRef.current = authConfig.id;
                p.form.setFieldValue('selectedAuthConfigId', authConfig.id);
                p.form.setFieldTouched('selectedAuthConfigId', false, false);
                p.form.setFieldError('selectedAuthConfigId', undefined);

                await Promise.resolve(authConfigs.refetch?.());

                // Re-apply after refetch so the created config remains selected
                // even if any stale-list cleanup ran during refresh.
                p.form.setFieldValue('selectedAuthConfigId', authConfig.id);
                p.form.setFieldTouched('selectedAuthConfigId', false, false);
                p.form.setFieldError('selectedAuthConfigId', undefined);
              }}
              size="3"
              iconLeft={<RiAddLine />}
              ariaLabel="Create Auth Config"
            >
              Create Auth Config
            </ProviderAuthConfigCreateButton>
          </Flex>

          <p.form.RenderError field="selectedAuthConfigId" />
        </div>
      )
    });
  }

  if (toolItems.length > 0) {
    let toolsListMaxHeight =
      toolItems.length >= 12
        ? 'min(520px, calc(100vh - 470px))'
        : toolItems.length >= 8
          ? 360
          : 280;
    let selectedKeys = new Set(p.form.values.selectedToolKeys);
    let allToolKeys = normalizedTools.map(tool => tool.key);
    let allToolKeySet = new Set(allToolKeys);
    let readOnlyToolKeySet = new Set(readOnlyTools.map(tool => tool.key));
    let writeDeleteToolKeySet = new Set(writeDeleteTools.map(tool => tool.key));
    let updateSelectedToolKeys = (nextKeys: string[]) => {
      p.form.setFieldValue('selectedToolKeys', nextKeys);
      p.form.setFieldTouched('selectedToolKeys', false, false);
      p.form.setFieldError('selectedToolKeys', undefined);
    };
    let setToolChecked = (toolKey: string, checked: boolean) => {
      setSectionModeOverrides(prev => ({
        ...prev,
        ...(readOnlyToolKeySet.has(toolKey) ? { read: undefined } : {}),
        ...(writeDeleteToolKeySet.has(toolKey) ? { write: undefined } : {})
      }));

      let nextKeys = checked
        ? [...new Set([...p.form.values.selectedToolKeys, toolKey])]
        : p.form.values.selectedToolKeys.filter(key => key !== toolKey);
      let isAllSelected =
        normalizedTools.length > 0 &&
        normalizedTools.every(tool => nextKeys.includes(tool.key)) &&
        nextKeys.length === allToolKeySet.size;

      p.form.setFieldValue('toolFilterMode', isAllSelected ? 'all' : 'select');
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
      sectionId: 'read' | 'write',
      sectionTools: { key: string }[]
    ): ToolPermissionMode => {
      return sectionModeOverrides[sectionId] ?? getSectionMode(sectionTools);
    };
    let setSectionMode = (
      sectionId: 'read' | 'write',
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
          ...new Set([
            ...p.form.values.selectedToolKeys,
            ...sectionTools.map(tool => tool.key)
          ])
        ];
        let isAllSelected =
          normalizedTools.length > 0 &&
          normalizedTools.every(tool => nextKeys.includes(tool.key)) &&
          nextKeys.length === allToolKeySet.size;
        p.form.setFieldValue('toolFilterMode', isAllSelected ? 'all' : 'select');
        updateSelectedToolKeys(nextKeys);
        return;
      }
      p.form.setFieldValue('toolFilterMode', 'select');
      updateSelectedToolKeys(
        p.form.values.selectedToolKeys.filter(key => !sectionToolKeySet.has(key))
      );
    };

    accordionItems.push({
      id: 'tools',
      title:
        provider.data?.type.auth.status == 'enabled' ? '3. Tool Filters' : '2. Tool Filters',
      description: 'Control which tools are allowed when sessions run from this template.',
      content: (
        <div
          style={{
            maxHeight: toolsListMaxHeight,
            overflowY: 'auto',
            marginRight: -20,
            paddingRight: 20
          }}
        >
          <Flex direction="column" gap={12}>
            {[
              { id: 'read', title: 'Read-Only Tools', tools: readOnlyTools },
              { id: 'write', title: 'Write/Delete Tools', tools: writeDeleteTools }
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
                        section.id as 'read' | 'write',
                        section.tools
                      )}
                      onChange={value => {
                        if (value !== 'allow' && value !== 'reject' && value !== 'mixed')
                          return;
                        setSectionMode(section.id as 'read' | 'write', section.tools, value);
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
      )
    });
  }

  let validateStepBeforeAdvance = (index: number) => {
    let step = accordionItems[index];
    if (!step) return true;

    if (step.id === 'auth' && requiresAuthConfig && !p.form.values.selectedAuthConfigId) {
      p.form.setFieldTouched('selectedAuthConfigId', true, false);
      p.form.setFieldError('selectedAuthConfigId', 'Select an auth config');
      return false;
    }

    return true;
  };

  let handleAccordionValueChange = (nextValue: string | string[]) => {
    if (Array.isArray(nextValue) || !nextValue) return;
    setIsAccordionCollapsed(false);
    let nextIndex = Number(nextValue);
    if (Number.isNaN(nextIndex)) return;

    if (nextIndex <= currentAccordionIndex) {
      setCurrentAccordionIndex(nextIndex);
      return;
    }

    if (nextIndex > currentAccordionIndex + 1) return;
    if (!validateStepBeforeAdvance(currentAccordionIndex)) return;

    setCurrentAccordionIndex(nextIndex);
    setMaxCompletedAccordionIndex(prev => Math.max(prev, nextIndex));
  };

  let accordionItemsWithLocks = accordionItems.map((item, index) => ({
    ...item,
    defaultOpen: index === currentAccordionIndex,
    disabled: index > currentAccordionIndex + 1
  }));

  let lastAccordionIndex = Math.max(0, accordionItems.length - 1);
  let allStepsCompleted = maxCompletedAccordionIndex >= lastAccordionIndex;
  let canSubmit =
    allStepsCompleted && (!requiresAuthConfig || Boolean(p.form.values.selectedAuthConfigId));

  let handleSubmitClick = async () => {
    if (!canSubmit) return;

    if (!validateStepBeforeAdvance(currentAccordionIndex)) return;

    setIsAccordionCollapsed(true);
    await p.form.submitForm();
  };

  return (
    <Flex direction="column" gap={10}>
      <SessionTemplateStepAccordion
        items={accordionItemsWithLocks}
        collapsible
        value={isAccordionCollapsed ? undefined : currentAccordionIndex.toString()}
        onValueChange={handleAccordionValueChange}
      />

      {p.mutationError}

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
    </Flex>
  );
};

export let showAddProviderPanelFlow = (p: {
  instanceId: string;
  sessionTemplateId: string;
  onComplete: () => void;
  sessionTemplateProviderId?: string;
  providerId?: string;
  hideProviderStep?: boolean;
  initialDeploymentId?: string;
  initialConfigId?: string;
  initialAuthConfigId?: string;
  initialToolFilter?: InitialToolFilter;
  title?: string;
  description?: string;
  action?: string;
}) =>
  showProviderCreationPanel(({ close, setWidth }) => (
    <AddProviderPanelFlow
      close={close}
      setPanelWidth={setWidth}
      instanceId={p.instanceId}
      sessionTemplateId={p.sessionTemplateId}
      sessionTemplateProviderId={p.sessionTemplateProviderId}
      providerId={p.providerId}
      hideProviderStep={p.hideProviderStep}
      initialDeploymentId={p.initialDeploymentId}
      initialConfigId={p.initialConfigId}
      initialAuthConfigId={p.initialAuthConfigId}
      initialToolFilter={p.initialToolFilter}
      title={p.title}
      description={p.description}
      action={p.action}
      onComplete={p.onComplete}
    />
  ));
