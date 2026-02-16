import { Paths } from '@metorial/frontend-config';
import { useCurrentInstance, useCreateSession } from '@metorial/state';
import { Button, Dialog, Input, Spacer } from '@metorial/ui';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export type ProviderSessionFormProps =
  | { type: 'create'; providerDeploymentId?: string; sessionTemplateId?: string }
  | { type: 'update'; sessionId: string };

export let ProviderSessionForm = (
  props: ProviderSessionFormProps & {
    close?: () => void;
    onCreate?: (session: any) => void;
  }
) => {
  let instance = useCurrentInstance();
  let navigate = useNavigate();
  let createMutation = useCreateSession(instance.data?.instanceId);

  let [name, setName] = useState('');
  let [description, setDescription] = useState('');
  let [deploymentId, setDeploymentId] = useState(
    props.type === 'create' ? (props.providerDeploymentId ?? '') : ''
  );

  let handleSubmit = async () => {
    if (!instance.data) return;

    if (props.type === 'create') {
      let providers = [];

      if (deploymentId) {
        providers.push({
          providerDeployment: {
            type: 'reference' as const,
            providerDeploymentId: deploymentId
          }
        });
      }

      let [result] = await createMutation.mutate({
        name: name || undefined,
        description: description || undefined,
        providers
      });

      if (!result) return;

      if (props.onCreate) {
        props.onCreate(result);
      } else {
        navigate(
          Paths.instance.providerSession(
            instance.data.organization,
            instance.data.project,
            instance.data,
            result.id
          )
        );
      }

      props.close?.();
    }
  };

  return (
    <>
      <Input label="Name (optional)" value={name} onChange={e => setName(e.target.value)} />

      <Spacer size={10} />

      <Input
        label="Description"
        value={description}
        onChange={e => setDescription(e.target.value)}
      />

      <Spacer size={10} />

      {props.type === 'create' && !props.providerDeploymentId && (
        <>
          <Input
            label="Provider Deployment ID"
            value={deploymentId}
            onChange={e => setDeploymentId(e.target.value)}
            placeholder="Enter a deployment ID to include in this session"
          />
          <Spacer size={10} />
        </>
      )}

      <Dialog.Actions>
        <Button variant="outline" onClick={props.close}>
          Cancel
        </Button>
        <Button onClick={handleSubmit} loading={createMutation.isPending}>
          {props.type === 'create' ? 'Create Session' : 'Update Session'}
        </Button>
      </Dialog.Actions>
    </>
  );
};
