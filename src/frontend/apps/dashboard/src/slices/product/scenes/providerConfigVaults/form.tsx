import { DashboardInstanceProviderDeploymentsConfigVaultsCreateOutput } from '@metorial/dashboard-sdk';
import { useForm } from '@metorial/data-hooks';
import {
  useCreateProviderConfigVault,
  useCurrentInstance,
  useProvider,
  useProviderConfigSchemaTarget,
  useProviderDeployment
} from '@metorial/state';
import {
  Button,
  CenteredSpinner,
  Dialog,
  Input,
  Spacer,
  Text
} from '@metorial/ui';
import { useState } from 'react';
import { getProviderConfigSchemaCapabilities } from '../../lib/providerCreationCapabilities';
import { JsonSchemaInput } from '../jsonSchemaInput';
import { ProviderContextCard } from '../providerContextCard';

export type ProviderConfigVaultFormProps = {
  type: 'create';
  instanceId?: string;
  providerId?: string;
  providerDeploymentId?: string;
};

export let ProviderConfigVaultForm = (
  props: ProviderConfigVaultFormProps & {
    close?: () => void;
    onCreate?: (vault: DashboardInstanceProviderDeploymentsConfigVaultsCreateOutput) => void;
    onBack?: () => void;
  }
) => {
  let instance = useCurrentInstance();
  let instanceId = props.instanceId ?? instance.data?.id;
  let createMutation = useCreateProviderConfigVault();
  let deployment = useProviderDeployment(instanceId, props.providerDeploymentId);
  let providerId = props.providerId ?? deployment.data?.providerId;
  let provider = useProvider(instanceId, providerId);
  let configSchema = useProviderConfigSchemaTarget(
    instanceId,
    providerId || props.providerDeploymentId
      ? {
          providerId: providerId ?? undefined,
          providerDeploymentId: props.providerDeploymentId
        }
      : null
  );
  let isDeploymentScoped = !!props.providerDeploymentId;

  let [vaultData, setVaultData] = useState<Record<string, unknown>>({});
  let schemaCapabilities = getProviderConfigSchemaCapabilities({
    schemaValue: configSchema.data?.schema,
    hasVaults: false,
    isLoading: configSchema.isLoading || (!!props.providerDeploymentId && deployment.isLoading)
  });
  let showEmptyState = !schemaCapabilities.canCreateConfigVault;
  let emptyStateMessage = schemaCapabilities.hasExplicitEmptySchema
    ? isDeploymentScoped
      ? schemaCapabilities.configVaultDisabledReason
      : 'This provider has no configurable values, so config vaults are not needed.'
    : isDeploymentScoped
      ? 'No editable configuration schema is available for this deployment, so a vault cannot be created from the dashboard yet.'
      : 'No editable configuration schema is available for this provider, so a vault cannot be created from the dashboard yet.';

  let form = useForm({
    initialValues: {
      name: '',
      description: ''
    },
    onSubmit: async values => {
      if (
        !instanceId ||
        !providerId ||
        !schemaCapabilities.canCreateConfigVault
      ) {
        return;
      }

      let [result] = await createMutation.mutate({
        instanceId,
        providerId,
        ...(props.providerDeploymentId
          ? { providerDeploymentId: props.providerDeploymentId }
          : {}),
        name: values.name.trim(),
        description: values.description || undefined,
        value: vaultData
      });

      if (!result) return;

      props.onCreate?.(result);
      props.close?.();
    },
    schema: yup =>
      yup.object({
        name: yup.string().trim().required('Name is required'),
        description: yup.string().defined()
      })
  });

  if (configSchema.isLoading || (!!props.providerDeploymentId && deployment.isLoading)) {
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

          <JsonSchemaInput
            schema={schemaCapabilities.schemaObject}
            value={vaultData}
            onChange={setVaultData}
            label="Vault Values"
          />

          <Spacer size={15} />

          <Dialog.Actions>
            <Button
              type="button"
              variant="outline"
              onClick={props.onBack ?? props.close}
            >
              {props.onBack ? 'Back' : 'Cancel'}
            </Button>
            <Button
              type="submit"
              loading={createMutation.isPending}
              disabled={!schemaCapabilities.canCreateConfigVault}
            >
              Create
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
