import { useForm } from '@metorial/data-hooks';
import {
  useCurrentInstance,
  useCreateProviderConfig,
  useProviderConfigSchema,
  useProviderDeployment
} from '@metorial/state';
import { Button, CenteredSpinner, Dialog, Input, Spacer, Text } from '@metorial/ui';
import { JSONSchema7 } from 'json-schema';
import { useState } from 'react';
import { JsonSchemaInput } from '../jsonSchemaInput';

export type ProviderConfigFormProps =
  | { type: 'create'; providerDeploymentId: string; instanceId?: string }
  | { type: 'update'; providerDeploymentId: string; configId: string; instanceId?: string };

export let ProviderConfigForm = (
  props: ProviderConfigFormProps & {
    close?: () => void;
    onCreate?: (config: any) => void;
    onBack?: () => void;
  }
) => {
  let instance = useCurrentInstance();
  let instanceId = props.instanceId ?? instance.data?.id;
  let createMutation = useCreateProviderConfig();
  let deployment = useProviderDeployment(instanceId, props.providerDeploymentId);

  // Fetch config schema for the provider deployment
  let configSchema = useProviderConfigSchema(instanceId, props.providerDeploymentId);

  let [configData, setConfigData] = useState<Record<string, any>>({});

  let hasSchema = configSchema.data?.schema && typeof configSchema.data.schema === 'object';
  let jsonSchema = configSchema.data?.schema?.schema;

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

    if (props.type !== 'create' || !instanceId || !deployment.data?.providerId || !hasSchema) {
      return;
    }

    let [result] = await createMutation.mutate({
      instanceId,
      providerDeploymentId: props.providerDeploymentId,
      name,
      description: form.values.description || undefined,
      providerId: deployment.data.providerId,
      value: configData
    });

    if (!result) return;

    props.onCreate?.(result);
    props.close?.();
  };

  if (configSchema.isLoading) {
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
            schema={(jsonSchema ?? {}) as JSONSchema7}
            value={configData}
            onChange={setConfigData}
            label="Configuration"
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
              {props.type === 'create' ? 'Create' : 'Update'}
            </Button>
          </Dialog.Actions>

          <createMutation.RenderError />
        </form>
      ) : (
        <Text size="2" color="gray600">
          No configuration schema is provided for this deployment, so this config cannot be
          created from the dashboard.
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
