import {
  DashboardInstanceProviderDeploymentsConfigsCreateOutput,
  DashboardInstanceProviderDeploymentsConfigVaultsListOutput
} from '@metorial/dashboard-sdk';
import { useForm } from '@metorial/data-hooks';
import {
  useCreateProviderConfig,
  useCurrentInstance,
  useProvider,
  useProviderConfigSchemaTarget,
  useProviderConfigVaults,
  useProviderDeployment
} from '@metorial/state';
import {
  Button,
  Callout,
  CenteredSpinner,
  Dialog,
  Input,
  Select,
  Spacer,
  Text
} from '@metorial/ui';
import { useEffect, useState } from 'react';
import { getProviderConfigSchemaCapabilities } from '../../lib/providerCreationCapabilities';
import { JsonSchemaInput } from '../jsonSchemaInput';
import {
  FlatCreateSection,
  FlatCreateSections
} from '../providerCreationPanel/flatCreateLayout';
import { ProviderContextCard } from '../providerContextCard';
import { Stepper } from '../stepper';

type ConfigSourceMode = '' | 'raw' | 'vault';

type ProviderConfigFormValues = {
  name: string;
  description: string;
  sourceMode: ConfigSourceMode;
  providerConfigVaultId: string;
  configData: Record<string, unknown>;
};

export type ProviderConfigFormProps =
  | {
      type: 'create';
      providerId?: string;
      providerDeploymentId?: string;
      instanceId?: string;
      embedded?: boolean;
      hideProviderContext?: boolean;
      flattenCreateFlow?: boolean;
    }
  | { type: 'update'; providerDeploymentId: string; configId: string; instanceId?: string };

export let ProviderConfigForm = (
  props: ProviderConfigFormProps & {
    close?: () => void;
    onCreate?: (config: DashboardInstanceProviderDeploymentsConfigsCreateOutput) => void;
    onBack?: () => void;
  }
) => {
  let instance = useCurrentInstance();
  let instanceId = props.instanceId ?? instance.data?.id;
  let createMutation = useCreateProviderConfig();
  let deployment = useProviderDeployment(instanceId, props.providerDeploymentId);
  let providerId =
    props.type === 'create'
      ? (props.providerId ?? deployment.data?.providerId)
      : deployment.data?.providerId;
  let provider = useProvider(instanceId, providerId);
  let vaults = useProviderConfigVaults(
    instanceId,
    props.type === 'create'
      ? {
          ...(providerId ? { providerId } : {}),
          ...(props.providerDeploymentId
            ? { providerDeploymentId: props.providerDeploymentId }
            : {})
        }
      : { providerDeploymentId: props.providerDeploymentId }
  );
  let configSchema = useProviderConfigSchemaTarget(
    instanceId,
    props.type === 'create'
      ? providerId || props.providerDeploymentId
        ? {
            ...(providerId ? { providerId } : {}),
            ...(props.providerDeploymentId
              ? { providerDeploymentId: props.providerDeploymentId }
              : {})
          }
        : null
      : props.providerDeploymentId
        ? { providerDeploymentId: props.providerDeploymentId }
        : null
  );
  let isDeploymentScoped = props.type === 'update' || !!props.providerDeploymentId;
  let [currentStep, setCurrentStep] = useState(0);

  let schemaCapabilities = getProviderConfigSchemaCapabilities({
    schemaValue: configSchema.data?.schema,
    hasVaults: (vaults.data?.items?.length ?? 0) > 0,
    isLoading: configSchema.isLoading || vaults.isLoading
  });
  let vaultItems: DashboardInstanceProviderDeploymentsConfigVaultsListOutput['items'] =
    vaults.data?.items ?? [];
  let canCreateFromVault = vaultItems.length > 0;
  let showEmptyState = !schemaCapabilities.canCreateConfig;
  let emptyStateCalloutMessage = schemaCapabilities.hasExplicitEmptySchema
    ? isDeploymentScoped
      ? 'This deployment has no configurable values. Its default config is created automatically.'
      : 'This provider has no configurable values. Its default config is created automatically.'
    : isDeploymentScoped
      ? 'This deployment has no configuration schema or config vault.'
      : 'This provider has no configuration schema or config vault.';

  let submitConfig = async (values: ProviderConfigFormValues) => {
    if (props.type !== 'create' || !instanceId || !providerId) {
      return;
    }

    if (values.sourceMode === 'vault') {
      let [result] = await createMutation.mutate({
        instanceId,
        name: values.name.trim(),
        description: values.description || undefined,
        providerId,
        ...(props.providerDeploymentId
          ? { providerDeploymentId: props.providerDeploymentId }
          : {}),
        providerConfigVaultId: values.providerConfigVaultId
      });

      if (!result) return;

      props.onCreate?.(result);
      props.close?.();
      return;
    }

    let [result] = await createMutation.mutate({
      instanceId,
      name: values.name.trim(),
      description: values.description || undefined,
      providerId,
      ...(props.providerDeploymentId
        ? { providerDeploymentId: props.providerDeploymentId }
        : {}),
      value: values.configData
    });

    if (!result) return;

    props.onCreate?.(result);
    props.close?.();
  };

  let form = useForm({
    initialValues: {
      name: '',
      description: '',
      sourceMode: '' as ConfigSourceMode,
      providerConfigVaultId: '',
      configData: {} as Record<string, unknown>
    },
    onSubmit: async () => undefined,
    schemaDependencies: [canCreateFromVault, schemaCapabilities.hasSchemaFields],
    schema: yup =>
      yup.object({
        name: yup.string().trim().required('Name is required'),
        description: yup.string(),
        sourceMode: yup
          .string()
          .oneOf(['raw', 'vault'], 'Source is required')
          .required('Source is required'),
        providerConfigVaultId: yup
          .string()
          .defined()
          .test(
            'provider-config-vault-required',
            'Config vault is required',
            function (value) {
              if (this.parent.sourceMode !== 'vault') return true;
              return !!value;
            }
          ),
        configData: yup.mixed<Record<string, unknown>>().defined()
      })
  });

  if (props.providerDeploymentId && deployment.isLoading) {
    return <CenteredSpinner />;
  }

  if (props.providerDeploymentId && deployment.error) {
    return (
      <>
        <Text size="2" color="red600">
          {deployment.error.message ?? 'Failed to load deployment details.'}
        </Text>

        <Spacer size={15} />

        <Dialog.Actions>
          <Button type="button" variant="outline" onClick={props.onBack ?? props.close}>
            {props.onBack ? 'Back' : 'Close'}
          </Button>
        </Dialog.Actions>
      </>
    );
  }

  if (props.providerDeploymentId && !providerId) {
    return (
      <Text size="2" color="gray600">
        Loading deployment details...
      </Text>
    );
  }

  useEffect(() => {
    if (!schemaCapabilities.hasSchemaFields && canCreateFromVault) {
      if (form.values.sourceMode !== 'vault') {
        form.setFieldValue('sourceMode', 'vault');
      }
      return;
    }

    if (schemaCapabilities.hasSchemaFields && !canCreateFromVault) {
      if (form.values.sourceMode !== 'raw') {
        form.setFieldValue('sourceMode', 'raw');
      }
      return;
    }

    if (!schemaCapabilities.hasSchemaFields && !canCreateFromVault && form.values.sourceMode) {
      form.setFieldValue('sourceMode', '');
    }
  }, [canCreateFromVault, form, form.values.sourceMode, schemaCapabilities.hasSchemaFields]);

  if (configSchema.isLoading || vaults.isLoading) {
    return <CenteredSpinner />;
  }

  let closeLabel = props.onBack ? 'Back' : 'Cancel';
  let closeAction = props.onBack ?? props.close;

  let validateDetailsStep = async () => {
    form.setFieldTouched('name', true, false);
    await form.validateField('name');

    return !form.getFieldMeta('name').error && !!form.values.name.trim();
  };

  let continueToSourceStep = async () => {
    if (!(await validateDetailsStep())) return;
    setCurrentStep(1);
  };

  let validateSourceStep = async () => {
    form.setFieldTouched('sourceMode', true, false);
    await form.validateField('sourceMode');

    return !form.getFieldMeta('sourceMode').error && !!form.values.sourceMode;
  };

  let continueToConfigureStep = async () => {
    if (!(await validateSourceStep())) return;
    setCurrentStep(2);
  };

  let createConfig = async () => {
    if (!(await validateDetailsStep())) return;
    if (!(await validateSourceStep())) return;

    if (form.values.sourceMode === 'vault') {
      form.setFieldTouched('providerConfigVaultId', true, false);
      await form.validateField('providerConfigVaultId');

      if (!form.values.providerConfigVaultId) return;
    }

    await submitConfig(form.values);
  };

  let sourceItems = [
    ...(schemaCapabilities.hasSchemaFields ? [{ id: 'raw', label: 'Manual values' }] : []),
    ...(canCreateFromVault ? [{ id: 'vault', label: 'Use config vault' }] : [])
  ];

  return (
    <>
      {providerId && !(props.type === 'create' && props.hideProviderContext) && (
        <>
          <ProviderContextCard
            providerId={providerId}
            providerName={provider.data?.name ?? providerId}
            providerImageUrl={provider.data?.publisher.imageUrl}
            deploymentName={deployment.data?.name}
            deploymentDescription={deployment.data?.description}
          />

          <Spacer size={10} />
        </>
      )}

      {!showEmptyState ? (
        props.type === 'create' && props.flattenCreateFlow ? (
          <form
            onSubmit={e => {
              e.preventDefault();
              void createConfig();
            }}
          >
            <FlatCreateSections>
              <FlatCreateSection>
                <Input label="Name" {...form.getFieldProps('name')} />
                <form.RenderError field="name" />

                <Spacer size={8} />

                <Input label="Description" {...form.getFieldProps('description')} />
                <form.RenderError field="description" />
              </FlatCreateSection>

              <FlatCreateSection>
                <Select
                  label="Source"
                  value={form.values.sourceMode}
                  placeholder="Select a source..."
                  onChange={value => {
                    form.setFieldValue('sourceMode', value as ConfigSourceMode);
                    form.setFieldTouched('sourceMode', false, false);
                    form.setFieldError('sourceMode', undefined);

                    if (value !== 'vault') {
                      form.setFieldValue('providerConfigVaultId', '');
                      form.setFieldTouched('providerConfigVaultId', false, false);
                      form.setFieldError('providerConfigVaultId', undefined);
                    }
                  }}
                  items={sourceItems}
                />
                <form.RenderError field="sourceMode" />

                {form.values.sourceMode === 'vault' ? (
                  <>
                    <Spacer size={8} />
                    <Select
                      label="Config Vault"
                      value={form.values.providerConfigVaultId}
                      placeholder="Select a config vault..."
                      onChange={value => {
                        form.setFieldValue('providerConfigVaultId', value);
                        form.setFieldTouched('providerConfigVaultId', false, false);
                        form.setFieldError('providerConfigVaultId', undefined);
                      }}
                      items={vaultItems.map(vault => ({
                        id: vault.id,
                        label: vault.name ?? vault.id
                      }))}
                    />
                    <form.RenderError field="providerConfigVaultId" />
                  </>
                ) : form.values.sourceMode === 'raw' ? (
                  <>
                    <Spacer size={8} />
                    <JsonSchemaInput
                      schema={schemaCapabilities.schemaObject}
                      value={form.values.configData}
                      onChange={value => form.setFieldValue('configData', value)}
                      label="Configuration"
                    />
                  </>
                ) : null}
              </FlatCreateSection>
            </FlatCreateSections>

            <Spacer size={15} />

            <Dialog.Actions>
              <Button type="button" variant="outline" onClick={closeAction}>
                {closeLabel}
              </Button>
              <Button
                type="submit"
                loading={createMutation.isLoading}
                disabled={
                  !form.values.sourceMode ||
                  !form.values.name.trim() ||
                  (form.values.sourceMode === 'vault' && !form.values.providerConfigVaultId)
                }
              >
                Create
              </Button>
            </Dialog.Actions>

            <createMutation.RenderError />
          </form>
        ) : (
          <Stepper
            currentStep={currentStep}
            setCurrentStep={setCurrentStep}
            steps={[
              {
                title: 'Details',
                subtitle: 'Name the config',
                render: () => (
                  <form
                    onSubmit={e => {
                      e.preventDefault();
                      void continueToSourceStep();
                    }}
                  >
                    <Input label="Name" required {...form.getFieldProps('name')} />
                    <form.RenderError field="name" />

                    <Spacer size={10} />

                    <Input label="Description" {...form.getFieldProps('description')} />
                    <form.RenderError field="description" />

                    <Spacer size={15} />

                    <Dialog.Actions>
                      <Button type="button" variant="outline" onClick={closeAction}>
                        {closeLabel}
                      </Button>
                      <Button type="submit">Continue</Button>
                    </Dialog.Actions>
                  </form>
                )
              },
              {
                title: 'Source',
                subtitle: 'Choose where values come from',
                render: () => (
                  <form
                    onSubmit={e => {
                      e.preventDefault();
                      void continueToConfigureStep();
                    }}
                  >
                    <Select
                      label="Source"
                      value={form.values.sourceMode}
                      placeholder="Select a source..."
                      onChange={value => {
                        form.setFieldValue('sourceMode', value as ConfigSourceMode);
                        form.setFieldTouched('sourceMode', false, false);
                        form.setFieldError('sourceMode', undefined);

                        if (value !== 'vault') {
                          form.setFieldValue('providerConfigVaultId', '');
                          form.setFieldTouched('providerConfigVaultId', false, false);
                          form.setFieldError('providerConfigVaultId', undefined);
                        }
                      }}
                      items={sourceItems}
                    />
                    <form.RenderError field="sourceMode" />

                    <Spacer size={10} />

                    <Text size="2" color="gray600">
                      {form.values.sourceMode === 'vault'
                        ? 'Choose an existing config vault on the next step.'
                        : 'Enter configuration values manually on the next step.'}
                    </Text>

                    <Spacer size={15} />

                    <Dialog.Actions>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setCurrentStep(0)}
                      >
                        Back
                      </Button>
                      <Button type="submit">Continue</Button>
                    </Dialog.Actions>
                  </form>
                )
              },
              {
                title: 'Configure',
                subtitle:
                  form.values.sourceMode === 'vault'
                    ? 'Select a config vault'
                    : 'Set configuration values',
                render: () => (
                  <form
                    onSubmit={e => {
                      e.preventDefault();
                      void createConfig();
                    }}
                  >
                    {form.values.sourceMode === 'vault' ? (
                      <>
                        <Select
                          label="Config Vault"
                          value={form.values.providerConfigVaultId}
                          placeholder="Select a config vault..."
                          onChange={value => {
                            form.setFieldValue('providerConfigVaultId', value);
                            form.setFieldTouched('providerConfigVaultId', false, false);
                            form.setFieldError('providerConfigVaultId', undefined);
                          }}
                          items={vaultItems.map(vault => ({
                            id: vault.id,
                            label: vault.name ?? vault.id
                          }))}
                        />
                        <form.RenderError field="providerConfigVaultId" />
                      </>
                    ) : (
                      <JsonSchemaInput
                        schema={schemaCapabilities.schemaObject}
                        value={form.values.configData}
                        onChange={value => form.setFieldValue('configData', value)}
                        label="Configuration"
                      />
                    )}

                    <Spacer size={15} />

                    <Dialog.Actions>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setCurrentStep(1)}
                      >
                        Back
                      </Button>
                      <Button
                        type="submit"
                        loading={createMutation.isLoading}
                        disabled={
                          !form.values.sourceMode ||
                          !form.values.name.trim() ||
                          (form.values.sourceMode === 'vault' &&
                            !form.values.providerConfigVaultId)
                        }
                      >
                        {props.type === 'create' ? 'Create' : 'Update'}
                      </Button>
                    </Dialog.Actions>

                    <createMutation.RenderError />
                  </form>
                )
              }
            ]}
          />
        )
      ) : (
        <>
          <Callout color="gray">{emptyStateCalloutMessage}</Callout>

          <Spacer size={15} />

          <Dialog.Actions>
            {props.onBack && (
              <Button type="button" variant="outline" onClick={props.onBack}>
                Back
              </Button>
            )}
            {props.close && (
              <Button type="button" color="black" variant="solid" onClick={props.close}>
                Close
              </Button>
            )}
          </Dialog.Actions>
        </>
      )}
    </>
  );
};
