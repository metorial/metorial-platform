import {
  DashboardInstanceProviderDeploymentsConfigsCreateOutput,
  DashboardInstanceProviderDeploymentsConfigVaultsListOutput
} from '@metorial/dashboard-sdk';
import { useForm } from '@metorial/data-hooks';
import {
  useCurrentInstance,
  useCreateProviderConfig,
  useProvider,
  useProviderConfigVaults,
  useProviderConfigSchemaTarget,
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
import { useEffect, useRef, useState } from 'react';
import { getProviderConfigSchemaCapabilities } from '../../lib/providerCreationCapabilities';
import { JsonSchemaInput } from '../jsonSchemaInput';
import { ProviderContextCard } from '../providerContextCard';

export type ProviderConfigFormProps =
  | {
      type: 'create';
      providerId?: string;
      providerDeploymentId?: string;
      instanceId?: string;
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
      ? props.providerId ?? deployment.data?.providerId
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
  let isDeploymentScoped =
    props.type === 'update' || !!props.providerDeploymentId;

  let [configData, setConfigData] = useState<Record<string, unknown>>({});
  let hasInitializedSourceMode = useRef(false);

  let form = useForm({
    initialValues: {
      name: '',
      description: '',
      sourceMode: 'raw' as 'raw' | 'vault',
      providerConfigVaultId: ''
    },
    onSubmit: async values => {
      if (props.type !== 'create' || !instanceId || !providerId) {
        return;
      }

      if (createFromVault && !values.providerConfigVaultId) {
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
              name: values.name.trim(),
              description: values.description || undefined,
              providerId,
              ...(props.providerDeploymentId
                ? { providerDeploymentId: props.providerDeploymentId }
                : {}),
              providerConfigVaultId: values.providerConfigVaultId
            }
          : {
              instanceId,
              name: values.name.trim(),
              description: values.description || undefined,
              providerId,
              ...(props.providerDeploymentId
                ? { providerDeploymentId: props.providerDeploymentId }
                : {}),
              value: configData
            }
      );

      if (!result) return;

      props.onCreate?.(result);
      props.close?.();
    },
    schema: yup =>
      yup.object({
        name: yup.string().trim().required('Name is required'),
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
  let canCreateFromVault = vaultItems.length > 0;
  let shouldUseVaultOnly =
    !schemaCapabilities.hasSchemaFields && canCreateFromVault;
  let createFromVault =
    shouldUseVaultOnly || form.values.sourceMode === 'vault';
  let showSourceSelect =
    schemaCapabilities.hasSchemaFields && canCreateFromVault;
  let showEmptyState =
    (!schemaCapabilities.hasSchemaFields && !canCreateFromVault);
  let emptyStateMessage = isDeploymentScoped
      ? 'No configuration schema or config vault is available for this deployment, so this config cannot be created from the dashboard.'
      : 'No configuration schema or config vault is available for this provider, so this config cannot be created from the dashboard.';

  useEffect(() => {
    if (shouldUseVaultOnly && form.values.sourceMode !== 'vault') {
      form.setFieldValue('sourceMode', 'vault');
      return;
    }

    if (!canCreateFromVault && form.values.sourceMode === 'vault') {
      form.setFieldValue('sourceMode', 'raw');
    }
  }, [canCreateFromVault, form, form.values.sourceMode, shouldUseVaultOnly]);

  useEffect(() => {
    if (hasInitializedSourceMode.current) return;

    if (canCreateFromVault && !shouldUseVaultOnly) {
      hasInitializedSourceMode.current = true;
      form.setFieldValue('sourceMode', 'vault');
      return;
    }

    if (!canCreateFromVault) {
      hasInitializedSourceMode.current = true;
    }
  }, [canCreateFromVault, form, shouldUseVaultOnly]);

  if (configSchema.isLoading || vaults.isLoading) {
    return <CenteredSpinner />;
  }

  return (
    <>
      {providerId && (
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
        <form onSubmit={form.handleSubmit}>
          <Input label="Name" required {...form.getFieldProps('name')} />
          <form.RenderError field="name" />

          <Spacer size={10} />

          <Input label="Description" {...form.getFieldProps('description')} />
          <form.RenderError field="description" />

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
              type="submit"
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
