import { useForm } from '@metorial/data-hooks';
import {
  useCreateProviderDeployment,
  useProvider,
  useProviderAuthConfigs,
  useProviderDeployment,
  useProviderDeployments,
  useProviderTools
} from '@metorial/state';
import {
  Button,
  CenteredSpinner,
  CheckList,
  Dialog,
  Flex,
  Input,
  OptionToggle,
  Select,
  showModal,
  Text
} from '@metorial/ui';
import { RiAddLine } from '@remixicon/react';
import { useEffect, useState, type ReactNode } from 'react';
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

export type ProviderConfigurationSelectionFormValues = {
  selectedProviderId: string;
  selectedProviderName: string;
  selectedDeploymentId: string;
  selectedConfiguration: ConfigurationSelection;
  selectedAuthConfigId: string;
  toolFilterMode: 'all' | 'select';
  selectedToolKeys: string[];
};

type ProviderConfigurationSelectionModalSubmitResult = {
  error?: {
    data?: {
      code?: string;
      entityId?: string;
    };
  } | null;
  success?: boolean;
};

type ProviderConfigurationSelectionForm = ReturnType<
  typeof useForm<ProviderConfigurationSelectionFormValues, any>
>;

export let ProviderConfigurationSelectionModalContent = ({
  instanceId,
  saving,
  mutationError,
  submitLabel,
  onSubmit,
  includeToolFilters = false,
  allowConfigVaultSelection = true
}: {
  instanceId: string;
  saving: boolean;
  mutationError?: ReactNode;
  submitLabel: string;
  onSubmit: (
    values: ProviderConfigurationSelectionFormValues
  ) => Promise<ProviderConfigurationSelectionModalSubmitResult | void>;
  includeToolFilters?: boolean;
  allowConfigVaultSelection?: boolean;
}) => {
  let [currentStep, setCurrentStep] = useState(0);
  let form = useForm<ProviderConfigurationSelectionFormValues, any>({
    initialValues: {
      selectedProviderId: '',
      selectedProviderName: '',
      selectedDeploymentId: '',
      selectedConfiguration: emptyConfigurationSelection(),
      selectedAuthConfigId: '',
      toolFilterMode: 'all',
      selectedToolKeys: []
    },
    onSubmit: async values => {
      let result = await onSubmit(values);
      if (result?.success) return;

      let errorCode = result?.error?.data?.code;
      let entityId = result?.error?.data?.entityId;
      if (errorCode !== 'use_after_delete' || !entityId) return;

      if (
        values.selectedConfiguration.kind !== 'none' &&
        entityId === values.selectedConfiguration.id
      ) {
        form.setFieldValue('selectedConfiguration', emptyConfigurationSelection());
        form.setFieldTouched('selectedConfiguration', true, false);
        form.setFieldError(
          'selectedConfiguration',
          values.selectedConfiguration.kind === 'vault'
            ? 'Selected config vault was deleted or archived. Choose another vault or leave Config empty.'
            : 'Selected provider config was deleted or archived. Choose another config or leave Config empty.'
        );
      }

      if (entityId === values.selectedAuthConfigId) {
        form.setFieldValue('selectedAuthConfigId', '');
        form.setFieldTouched('selectedAuthConfigId', true, false);
        form.setFieldError(
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
        toolFilterMode: yup.mixed<'all' | 'select'>().oneOf(['all', 'select']).required(),
        selectedToolKeys: yup.array().of(yup.string().required()).defined()
      })
  });

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
            <form onSubmit={form.handleSubmit}>
              <DeploymentConfigureStep
                form={form}
                instanceId={instanceId}
                deploymentId={form.values.selectedDeploymentId}
                providerId={form.values.selectedProviderId}
                providerName={form.values.selectedProviderName}
                saving={saving}
                mutationError={mutationError}
                submitLabel={submitLabel}
                includeToolFilters={includeToolFilters}
                allowConfigVaultSelection={allowConfigVaultSelection}
              />
            </form>
          )
        }
      ]}
    />
  );
};

export let showProviderConfigurationSelectionModal = (p: {
  title: string;
  description: string;
  render: (close: () => void) => ReactNode;
}) =>
  showModal(({ dialogProps, close }) => (
    <Dialog.Wrapper {...dialogProps} width={650}>
      <Dialog.Title>{p.title}</Dialog.Title>
      <Dialog.Description>{p.description}</Dialog.Description>
      {p.render(close)}
    </Dialog.Wrapper>
  ));

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
    onSubmit: async values => {
      let [res] = await createMutation.mutate({
        instanceId,
        providerId,
        name: values.name.trim(),
        description: values.description?.trim() || undefined
      });

      if (res) {
        onCreated(res.id);
      }
    },
    schema: yup =>
      yup.object({
        name: yup.string().required('Name is required'),
        description: yup.string()
      })
  });

  return (
    <Flex direction="column" gap={8}>
      <form onSubmit={form.handleSubmit}>
        <Flex direction="column" gap={8}>
          <Input label="Name" required {...form.getFieldProps('name')} />
          <form.RenderError field="name" />

          <Input label="Description" {...form.getFieldProps('description')} />
          <form.RenderError field="description" />

          <div style={{ marginTop: 5 }}>
            <Dialog.Actions>
              <Button
                type="submit"
                loading={createMutation.isLoading}
                success={createMutation.isSuccess}
              >
                Create Deployment
              </Button>

              <createMutation.RenderError />
            </Dialog.Actions>
          </div>
        </Flex>
      </form>
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
  let items = deployments.data?.items ?? [];
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
    <Flex direction="column" gap={8}>
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
  form,
  instanceId,
  deploymentId,
  providerId,
  providerName,
  saving,
  mutationError,
  submitLabel,
  includeToolFilters,
  allowConfigVaultSelection
}: {
  form: ProviderConfigurationSelectionForm;
  instanceId: string;
  deploymentId: string;
  providerId: string;
  providerName: string;
  saving: boolean;
  mutationError?: ReactNode;
  submitLabel: string;
  includeToolFilters: boolean;
  allowConfigVaultSelection: boolean;
}) => {
  let authConfigs = useProviderAuthConfigs(instanceId, { providerDeploymentId: deploymentId });
  let deployment = useProviderDeployment(instanceId, deploymentId);
  let provider = useProvider(instanceId, providerId);
  let providerVersionId =
    deployment.data?.lockedVersion?.id ?? provider.data?.currentVersion?.id ?? null;
  let tools = useProviderTools(instanceId, providerVersionId ? { providerVersionId } : null);
  let authCreation = useProviderAuthCreationCapabilities(instanceId, deploymentId, providerId);
  let authConfigItems = authConfigs.data?.items ?? [];
  let toolItems = tools.data?.items ?? [];
  let selectedAuthConfigId = form.values.selectedAuthConfigId;

  useEffect(() => {
    if (authConfigs.isLoading || !selectedAuthConfigId) return;
    if (!authConfigItems.some(item => item.id === selectedAuthConfigId)) {
      form.setFieldValue('selectedAuthConfigId', '');
      form.setFieldTouched('selectedAuthConfigId', false, false);
      form.setFieldError('selectedAuthConfigId', undefined);
    }
  }, [authConfigs.isLoading, authConfigItems, form, selectedAuthConfigId]);

  useEffect(() => {
    if (form.values.toolFilterMode !== 'all' || form.values.selectedToolKeys.length === 0)
      return;
    form.setFieldValue('selectedToolKeys', []);
  }, [form, form.values.selectedToolKeys, form.values.toolFilterMode]);

  if (
    deployment.isLoading ||
    authConfigs.isLoading ||
    (deployment.data && !deployment.data.lockedVersion?.id && provider.isLoading) ||
    (includeToolFilters && tools.isLoading)
  ) {
    return <CenteredSpinner />;
  }

  return (
    <Flex direction="column" gap={10}>
      <ProviderConfigurationSelection
        instanceId={instanceId}
        providerDeploymentId={deploymentId}
        value={form.values.selectedConfiguration}
        onChange={value => {
          form.setFieldValue('selectedConfiguration', value);
          form.setFieldTouched('selectedConfiguration', false, false);
          form.setFieldError('selectedConfiguration', undefined);
        }}
        label="Config"
        includeVaults={allowConfigVaultSelection}
      />
      <form.RenderError field="selectedConfiguration" />

      {(provider.data?.type.auth.status == 'enabled' || true) && (
        <>
          <Flex gap={8} align="end">
            <div style={{ flex: 1 }}>
              <Select
                label="Auth Config"
                value={form.values.selectedAuthConfigId || '__none__'}
                onChange={v => {
                  form.setFieldValue('selectedAuthConfigId', v === '__none__' ? '' : v);
                  form.setFieldTouched('selectedAuthConfigId', false, false);
                  form.setFieldError('selectedAuthConfigId', undefined);
                }}
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
                      form.setFieldValue('selectedAuthConfigId', authConfig.id);
                      form.setFieldTouched('selectedAuthConfigId', false, false);
                      form.setFieldError('selectedAuthConfigId', undefined);
                    }
                  })
                }
              />
            </div>
          </Flex>
          <form.RenderError field="selectedAuthConfigId" />
        </>
      )}

      {includeToolFilters && toolItems.length > 0 && (
        <div>
          <Flex direction="column" gap={6}>
            <OptionToggle
              label="Tool Filters"
              size="2"
              value={form.values.toolFilterMode}
              onChange={value => {
                if (value !== 'all' && value !== 'select') return;
                form.setFieldValue('toolFilterMode', value);
              }}
              items={[
                {
                  id: 'all',
                  label: `Allow all tools`
                },
                {
                  id: 'select',
                  label: 'Select tools'
                }
              ]}
            />

            {form.values.toolFilterMode === 'select' && (
              <CheckList
                items={toolItems.map(tool => {
                  let toolKey = tool.key ?? tool.name;
                  return {
                    id: toolKey,
                    label: tool.name,
                    isChecked: form.values.selectedToolKeys.includes(toolKey)
                  };
                })}
                onChange={items => {
                  form.setFieldValue(
                    'selectedToolKeys',
                    items.filter(item => item.isChecked).map(item => item.id)
                  );
                }}
              />
            )}
          </Flex>
        </div>
      )}

      {mutationError}

      <div style={{ marginTop: 5 }}>
        <Dialog.Actions>
          <Button type="submit" loading={saving} size="2">
            {submitLabel}
          </Button>
        </Dialog.Actions>
      </div>
    </Flex>
  );
};
