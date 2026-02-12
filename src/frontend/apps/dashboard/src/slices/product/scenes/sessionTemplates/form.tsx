import { Paths } from '@metorial/frontend-config';
import { useCurrentInstance, useCreateSessionTemplate } from '@metorial/state';
import { Button, Dialog, Input, Spacer } from '@metorial/ui';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export type SessionTemplateFormProps =
  | { type: 'create' }
  | { type: 'update'; templateId: string };

export let SessionTemplateForm = (
  props: SessionTemplateFormProps & {
    close?: () => void;
    onCreate?: (template: any) => void;
  }
) => {
  let instance = useCurrentInstance();
  let navigate = useNavigate();
  let createMutation = useCreateSessionTemplate();

  let [name, setName] = useState('');
  let [description, setDescription] = useState('');

  let handleSubmit = async () => {
    if (!instance.data) return;

    if (props.type === 'create') {
      let [result] = await createMutation.mutate({
        instanceId: instance.data.instanceId,
        name,
        description: description || undefined
      });

      if (!result) return;

      if (props.onCreate) {
        props.onCreate(result);
      } else {
        navigate(
          Paths.instance.sessionTemplate(
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
      <Input label="Name" value={name} onChange={e => setName(e.target.value)} required />

      <Spacer size={10} />

      <Input
        label="Description"
        value={description}
        onChange={e => setDescription(e.target.value)}
      />

      <Spacer size={15} />

      <Dialog.Actions>
        <Button variant="outline" onClick={props.close}>
          Cancel
        </Button>
        <Button onClick={handleSubmit} loading={createMutation.isPending} disabled={!name}>
          {props.type === 'create' ? 'Create' : 'Update'}
        </Button>
      </Dialog.Actions>
    </>
  );
};
