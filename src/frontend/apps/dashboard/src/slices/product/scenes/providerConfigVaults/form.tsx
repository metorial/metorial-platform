import { DashboardInstanceProviderDeploymentsConfigVaultsCreateOutput } from '@metorial/dashboard-sdk';
import { useForm } from '@metorial/data-hooks';
import {
  useCreateProviderConfigVault,
  useCurrentInstance,
  useProviderConfigSchema,
  useProviderDeployment
} from '@metorial/state';
import { Button, CenteredSpinner, Dialog, Input, Spacer, Text } from '@metorial/ui';
import { useState } from 'react';
import { getJsonSchemaObject } from '../../lib/jsonSchema';
import { JsonSchemaInput } from '../jsonSchemaInput';

export type ProviderConfigVaultFormProps = {
  type: 'create';
  providerDeploymentId: string;
  instanceId?: string;
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
  let configSchema = useProviderConfigSchema(instanceId, props.providerDeploymentId);

  let [vaultData, setVaultData] = useState<Record<string, unknown>>({});

  let jsonSchema = getJsonSchemaObject(configSchema.data?.schema);
  let hasSchema = !!jsonSchema;

  let form = useForm({
    initialValues: {
      name: '',
      description: ''
    },
    onSubmit: async () => {},
    schema: yup =>
      yup.object({
        name: yup.string().required('Name is required'),
        description: yup.string().defined()
      })
  });

  let handleSubmit = async () => {
    let name = form.values.name.trim();

    if (!name) {
      form.setFieldTouched('name', true);
      form.setFieldError('name', 'Name is required');
      return;
    }

    form.setFieldError('name', undefined);

    if (!instanceId || !deployment.data?.providerId || !hasSchema) return;

    let [result] = await createMutation.mutate({
      instanceId,
      providerId: deployment.data.providerId,
      providerDeploymentId: props.providerDeploymentId,
      name,
      description: form.values.description || undefined,
      value: vaultData
    });

    if (!result) return;

    props.onCreate?.(result);
    props.close?.();
  };

  if (configSchema.isLoading || deployment.isLoading) {
    return <CenteredSpinner />;
  }

  return (
    <>
      {hasSchema ? (
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

          <JsonSchemaInput
            schema={jsonSchema}
            value={vaultData}
            onChange={setVaultData}
            label="Vault Values"
          />

          <Spacer size={15} />

          <Dialog.Actions>
            <Button type="button" variant="outline" onClick={props.close}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSubmit}
              loading={createMutation.isPending}
              disabled={!hasSchema}
            >
              Create
            </Button>
          </Dialog.Actions>

          <createMutation.RenderError />
        </form>
      ) : (
        <Text size="2" color="gray600">
          No configuration schema is available for this deployment, so a vault cannot be created
          from the dashboard yet.
        </Text>
      )}

      {!hasSchema && (
        <>
          <Spacer size={15} />

          <Dialog.Actions>
            <Button variant="outline" onClick={props.onBack ?? props.close}>
              Back
            </Button>
          </Dialog.Actions>
        </>
      )}
    </>
  );
};
