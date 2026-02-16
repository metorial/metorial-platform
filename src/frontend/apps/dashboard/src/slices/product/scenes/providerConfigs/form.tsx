import {
  useCurrentInstance,
  useCreateProviderConfig,
  useProviderConfigSchema
} from '@metorial/state';
import { Button, CenteredSpinner, Dialog, Input, Spacer, Text } from '@metorial/ui';
import { JSONSchema7 } from 'json-schema';
import { useState } from 'react';
import { JsonSchemaInput } from '../jsonSchemaInput';

export type ProviderConfigFormProps =
  | { type: 'create'; providerDeploymentId: string }
  | { type: 'update'; providerDeploymentId: string; configId: string };

export let ProviderConfigForm = (
  props: ProviderConfigFormProps & {
    close?: () => void;
    onCreate?: (config: any) => void;
    onBack?: () => void;
  }
) => {
  let instance = useCurrentInstance();
  let createMutation = useCreateProviderConfig();

  // Fetch config schema for the provider deployment
  let configSchema = useProviderConfigSchema(
    instance.data?.instanceId,
    props.providerDeploymentId
  );

  let [name, setName] = useState('');
  let [description, setDescription] = useState('');
  let [configData, setConfigData] = useState<Record<string, any>>({});

  let hasSchema = configSchema.data?.schema && typeof configSchema.data.schema === 'object';

  let handleSubmit = async () => {
    if (!instance.data) return;

    if (props.type === 'create') {
      let parsedConfig: Record<string, any> = {};

      if (hasSchema) {
        // Use the structured config data from JsonSchemaInput
        parsedConfig = configData;
      } else {
        return;
      }

      let [result] = await createMutation.mutate({
        instanceId: instance.data.instanceId,
        providerDeploymentId: props.providerDeploymentId,
        name,
        description: description || undefined,
        config: { type: 'new', data: parsedConfig }
      });

      if (!result) return;

      props.onCreate?.(result);
      props.close?.();
    }
  };

  if (configSchema.isLoading) {
    return <CenteredSpinner />;
  }

  return (
    <>
      {hasSchema ? (
        <>
          <Input label="Name" value={name} onChange={e => setName(e.target.value)} required />

          <Spacer size={10} />

          <Input
            label="Description"
            value={description}
            onChange={e => setDescription(e.target.value)}
          />

          <Spacer size={10} />

          <JsonSchemaInput
            schema={configSchema.data!.schema as JSONSchema7}
            value={configData}
            onChange={setConfigData}
            label="Configuration"
          />
        </>
      ) : (
        <Text size="2" color="gray600">
          No configuration schema is provided for this deployment, so this config cannot be
          created from the dashboard.
        </Text>
      )}

      <Spacer size={15} />

      <Dialog.Actions>
        {hasSchema ? (
          <>
            <Button variant="outline" onClick={props.close}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              loading={createMutation.isPending}
              disabled={!name || !hasSchema}
            >
              {props.type === 'create' ? 'Create' : 'Update'}
            </Button>
          </>
        ) : (
          <Button variant="outline" onClick={props.onBack ?? props.close}>
            Back
          </Button>
        )}
      </Dialog.Actions>
    </>
  );
};
