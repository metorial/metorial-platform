import {
  DashboardInstanceProviderDeploymentsConfigsCreateOutput,
  DashboardInstanceProviderDeploymentsConfigVaultsListOutput
} from '@metorial/dashboard-sdk';
import { useForm } from '@metorial/data-hooks';
import {
  useCreateProviderConfig,
  useCurrentInstance,
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
  InputLabel,
  Select,
  Spacer,
  Text
} from '@metorial/ui';
import { useEffect } from 'react';
import { getProviderConfigSchemaCapabilities } from '../../lib/providerCreationCapabilities';
import { JsonSchemaInput } from '../jsonSchemaInput';
import { FlatCreateSection } from '../providerCreationPanel/flatCreateLayout';

type ConfigSourceMode = '' | 'raw' | 'vault';

type ProviderConfigFormValues = {
  name: string;
  description: string;
  sourceMode: ConfigSourceMode;
  providerConfigVaultId: string;
  configData: Record<string, unknown>;
};

export type ProviderConfigFormProps = {
  type: 'create';
  providerId?: string;
  providerDeploymentId?: string;
  instanceId?: string;
  embedded?: boolean;
};

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
  let providerId = props.providerId ?? deployment.data?.providerId;
  let vaults = useProviderConfigVaults(instanceId, {
    ...(providerId ? { providerId } : {}),
    ...(props.providerDeploymentId ? { providerDeploymentId: props.providerDeploymentId } : {})
  });
  let configSchema = useProviderConfigSchemaTarget(
    instanceId,
    providerId || props.providerDeploymentId
      ? {
          ...(providerId ? { providerId } : {}),
          ...(props.providerDeploymentId
            ? { providerDeploymentId: props.providerDeploymentId }
            : {})
        }
      : null
  );
  let isDeploymentScoped = !!props.providerDeploymentId;

  let schemaCapabilities = getProviderConfigSchemaCapabilities({
    schemaValue: configSchema.data?.schema,
    hasVaults: (vaults.data?.items?.length ?? 0) > 0,
    isLoading: configSchema.isLoading || vaults.isLoading
  });
  let vaultItems: DashboardInstanceProviderDeploymentsConfigVaultsListOutput['items'] =
    vaults.data?.items ?? [];
  let canCreateManualConfig =
    schemaCapabilities.hasSchemaFields || schemaCapabilities.hasExplicitEmptySchema;
  let canCreateFromVault = vaultItems.length > 0;
  let showEmptyState = !schemaCapabilities.canCreateConfig;
  let emptyStateCalloutMessage = isDeploymentScoped
    ? 'This deployment has no configuration schema or config vault.'
    : 'This provider has no configuration schema or config vault.';
  let emptyConfigCalloutMessage = schemaCapabilities.hasExplicitEmptySchema
    ? isDeploymentScoped
      ? 'This deployment has no configurable values. The config will be created with empty values.'
      : 'This provider has no configurable values. The config will be created with empty values.'
    : isDeploymentScoped
      ? 'This deployment has no configurable fields. The config will be created with empty values.'
      : 'This provider has no configurable fields. The config will be created with empty values.';

  let submitConfig = async (values: ProviderConfigFormValues) => {
    if (!instanceId || !providerId) {
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

  useEffect(() => {
    if (!canCreateManualConfig && canCreateFromVault) {
      if (form.values.sourceMode !== 'vault') {
        form.setFieldValue('sourceMode', 'vault');
      }
      return;
    }

    if (canCreateManualConfig && !canCreateFromVault) {
      if (form.values.sourceMode !== 'raw') {
        form.setFieldValue('sourceMode', 'raw');
      }
      return;
    }

    if (!canCreateManualConfig && !canCreateFromVault && form.values.sourceMode) {
      form.setFieldValue('sourceMode', '');
    }
  }, [canCreateFromVault, canCreateManualConfig, form, form.values.sourceMode]);

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

  if (configSchema.isLoading || vaults.isLoading) {
    return <CenteredSpinner />;
  }

  let closeLabel = props.onBack ? 'Back' : 'Cancel';
  let closeAction = props.onBack ?? props.close;

  let createConfig = async () => {
    form.setFieldTouched('name', true, false);
    await form.validateField('name');
    if (form.getFieldMeta('name').error || !form.values.name.trim()) return;

    form.setFieldTouched('sourceMode', true, false);
    await form.validateField('sourceMode');
    if (form.getFieldMeta('sourceMode').error || !form.values.sourceMode) return;

    if (form.values.sourceMode === 'vault') {
      form.setFieldTouched('providerConfigVaultId', true, false);
      await form.validateField('providerConfigVaultId');

      if (!form.values.providerConfigVaultId) return;
    }

    await submitConfig(form.values);
  };

  let sourceItems = [
    ...(canCreateManualConfig ? [{ id: 'raw', label: 'Manual values' }] : []),
    ...(canCreateFromVault ? [{ id: 'vault', label: 'Use config vault' }] : [])
  ];
  let hideSourceSelectInFlatCreate = canCreateManualConfig && !canCreateFromVault;

  return (
    <>
      {!showEmptyState ? (
        <form
          onSubmit={e => {
            e.preventDefault();
            void createConfig();
          }}
        >
          <Input label="Name" {...form.getFieldProps('name')} />
          <form.RenderError field="name" />

          <Spacer size={8} />

          <Input label="Description" {...form.getFieldProps('description')} />
          <form.RenderError field="description" />

          <Spacer size={10} />

          {!hideSourceSelectInFlatCreate ? (
            <>
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
            </>
          ) : null}

          {form.values.sourceMode ? (
            <>
              <Spacer size={10} />
              {form.values.sourceMode === 'vault' ? (
                <FlatCreateSection>
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
                </FlatCreateSection>
              ) : schemaCapabilities.hasSchemaFields ? (
                <>
                  <InputLabel>Configuration</InputLabel>
                  <FlatCreateSection>
                    <JsonSchemaInput
                      schema={schemaCapabilities.schemaObject}
                      value={form.values.configData}
                      onChange={value => form.setFieldValue('configData', value)}
                    />
                  </FlatCreateSection>
                </>
              ) : (
                <Callout color="gray">{emptyConfigCalloutMessage}</Callout>
              )}
            </>
          ) : null}

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
