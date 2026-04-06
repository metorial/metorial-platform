import { DashboardInstanceProviderDeploymentsConfigVaultsCreateOutput } from '@metorial/dashboard-sdk';
import { useForm } from '@metorial/data-hooks';
import {
  useCreateProviderConfigVault,
  useCurrentInstance,
  useProviderConfigSchemaTarget,
  useProviderDeployment
} from '@metorial/state';
import { Button, Callout, CenteredSpinner, Dialog, Input, Spacer, Text } from '@metorial/ui';
import { getProviderConfigSchemaCapabilities } from '../../lib/providerCreationCapabilities';
import { JsonSchemaInput } from '../jsonSchemaInput';

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

  let schemaCapabilities = getProviderConfigSchemaCapabilities({
    schemaValue: configSchema.data?.schema,
    hasVaults: false,
    isLoading: configSchema.isLoading || (!!props.providerDeploymentId && deployment.isLoading)
  });
  let showEmptyState = !schemaCapabilities.canCreateConfigVault;
  let emptyStateCalloutMessage = schemaCapabilities.hasExplicitEmptySchema
    ? isDeploymentScoped
      ? 'This deployment has no configurable values. Config vaults are not available.'
      : 'This provider has no configurable values. Config vaults are not available.'
    : isDeploymentScoped
      ? 'This deployment has no editable configuration schema.'
      : 'This provider has no editable configuration schema.';

  let form = useForm({
    initialValues: {
      name: '',
      description: '',
      vaultData: {} as Record<string, unknown>
    },
    onSubmit: async values => {
      if (!instanceId || !providerId || !schemaCapabilities.canCreateConfigVault) {
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
        value: values.vaultData
      });

      if (!result) return;

      props.onCreate?.(result);
      props.close?.();
    },
    schema: yup =>
      yup.object({
        name: yup.string().trim().required('Name is required'),
        description: yup.string(),
        vaultData: yup.mixed<Record<string, unknown>>().defined()
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

  if (configSchema.isLoading) {
    return <CenteredSpinner />;
  }

  return (
    <>
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
            value={form.values.vaultData}
            onChange={value => form.setFieldValue('vaultData', value)}
            label="Vault Values"
          />

          <Spacer size={15} />

          <Dialog.Actions>
            <Button type="button" variant="outline" onClick={props.onBack ?? props.close}>
              {props.onBack ? 'Back' : 'Cancel'}
            </Button>
            <Button
              type="submit"
              loading={createMutation.isLoading}
              disabled={!schemaCapabilities.canCreateConfigVault}
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
