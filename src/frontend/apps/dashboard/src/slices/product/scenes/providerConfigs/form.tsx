import {
  DashboardInstanceProviderDeploymentsConfigsCreateOutput,
  DashboardInstanceProviderDeploymentsConfigVaultsListOutput
} from '@metorial/dashboard-sdk';
import { useForm } from '@metorial/data-hooks';
import {
  useCurrentInstance,
  useCreateProviderConfig,
  useProviderConfigVaults,
  useProviderConfigSchema,
  useProviderDeployment
} from '@metorial/state';
import {
  Button,
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

export type ProviderConfigFormProps =
  | { type: 'create'; providerDeploymentId: string; instanceId?: string }
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
  let vaults = useProviderConfigVaults(instanceId, { providerDeploymentId: props.providerDeploymentId });

  // Fetch config schema for the provider deployment
  let configSchema = useProviderConfigSchema(instanceId, props.providerDeploymentId);

  let [configData, setConfigData] = useState<Record<string, unknown>>({});

  let form = useForm({
    initialValues: {
      name: '',
      description: '',
      sourceMode: 'raw' as 'raw' | 'vault',
      providerConfigVaultId: ''
    },
    onSubmit: async () => {},
    schema: yup =>
      yup.object({
        name: yup.string().required('Name is required'),
        description: yup.string().defined(),
        sourceMode: yup.mixed<'raw' | 'vault'>().oneOf(['raw', 'vault']).required(),
        providerConfigVaultId: yup.string().defined()
      })
  });

  let schemaCapabilities = getProviderConfigSchemaCapabilities({
    schemaValue: configSchema.data?.schema,
    hasVaults: (vaults.data?.items?.length ?? 0) > 0,
    isLoading: configSchema.isLoading || vaults.isLoading
  });
  let vaultItems: DashboardInstanceProviderDeploymentsConfigVaultsListOutput['items'] =
    vaults.data?.items ?? [];
  let canCreateFromVault =
    vaultItems.length > 0 && !schemaCapabilities.hasExplicitEmptySchema;
  let shouldUseVaultOnly =
    !schemaCapabilities.hasSchemaFields && canCreateFromVault;
  let createFromVault =
    shouldUseVaultOnly || form.values.sourceMode === 'vault';
  let showSourceSelect =
    schemaCapabilities.hasSchemaFields && canCreateFromVault;
  let showEmptyState =
    schemaCapabilities.hasExplicitEmptySchema ||
    (!schemaCapabilities.hasSchemaFields && !canCreateFromVault);
  let emptyStateMessage = schemaCapabilities.hasExplicitEmptySchema
    ? schemaCapabilities.configDisabledReason
    : 'No configuration schema or config vault is available for this deployment, so this config cannot be created from the dashboard.';

  useEffect(() => {
    if (shouldUseVaultOnly && form.values.sourceMode !== 'vault') {
      form.setFieldValue('sourceMode', 'vault');
      return;
    }

    if (!canCreateFromVault && form.values.sourceMode === 'vault') {
      form.setFieldValue('sourceMode', 'raw');
    }
  }, [canCreateFromVault, form, form.values.sourceMode, shouldUseVaultOnly]);

  let handleSubmit = async () => {
    let name = form.values.name.trim();

    if (!name) {
      form.setFieldTouched('name', true);
      form.setFieldError('name', 'Name is required');
      return;
    }

    form.setFieldError('name', undefined);

    if (props.type !== 'create' || !instanceId || !deployment.data?.providerId) {
      return;
    }

    if (createFromVault && !form.values.providerConfigVaultId) {
      form.setFieldTouched('providerConfigVaultId', true, false);
      form.setFieldError('providerConfigVaultId', 'Config vault is required');
      return;
    }

    if (!createFromVault && !schemaCapabilities.hasSchemaFields) {
      return;
    }

    let [result] = await createMutation.mutate(
      createFromVault
        ? {
            instanceId,
            providerDeploymentId: props.providerDeploymentId,
            name,
            description: form.values.description || undefined,
            providerId: deployment.data.providerId,
            providerConfigVaultId: form.values.providerConfigVaultId
          }
        : {
            instanceId,
            providerDeploymentId: props.providerDeploymentId,
            name,
            description: form.values.description || undefined,
            providerId: deployment.data.providerId,
            value: configData
          }
    );

    if (!result) return;

    props.onCreate?.(result);
    props.close?.();
  };

  if (configSchema.isLoading || vaults.isLoading) {
    return <CenteredSpinner />;
  }

  return (
    <>
      {!showEmptyState ? (
        <form
          onSubmit={e => {
            e.preventDefault();
            handleSubmit();
          }}
        >
          <Input label="Name" required {...form.getFieldProps('name')} />
          <form.RenderError field="name" />

          <Spacer size={10} />

          <Input label="Description" {...form.getFieldProps('description')} />

          <Spacer size={10} />

          {showSourceSelect && (
            <>
              <Select
                label="Source"
                value={form.values.sourceMode}
                onChange={value => form.setFieldValue('sourceMode', value as 'raw' | 'vault')}
                items={[
                  ...(schemaCapabilities.hasSchemaFields
                    ? [{ id: 'raw', label: 'Manual values' }]
                    : []),
                  ...(canCreateFromVault ? [{ id: 'vault', label: 'Use config vault' }] : [])
                ]}
              />

              <Spacer size={10} />
            </>
          )}

          {createFromVault ? (
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
              value={configData}
              onChange={setConfigData}
              label="Configuration"
            />
          )}

          <Spacer size={15} />

          <Dialog.Actions>
            <Button type="button" variant="outline" onClick={props.close}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSubmit}
              loading={createMutation.isPending}
              disabled={!createFromVault && !schemaCapabilities.hasSchemaFields}
            >
              {props.type === 'create' ? 'Create' : 'Update'}
            </Button>
          </Dialog.Actions>

          <createMutation.RenderError />
        </form>
      ) : (
        <Text size="2" color="gray600">
          {emptyStateMessage}
        </Text>
      )}

      {showEmptyState && (
        <>
          <Spacer size={15} />

          <Dialog.Actions>
            <Button variant="outline" onClick={props.onBack ?? props.close}>
              {props.onBack ? 'Back' : 'Close'}
            </Button>
          </Dialog.Actions>
        </>
      )}
    </>
  );
};
