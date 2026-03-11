import { DashboardInstanceSessionsCreateOutput } from '@metorial/dashboard-sdk';
import { useForm } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import { useCurrentInstance, useCreateSession } from '@metorial/state';
import { Button, Dialog, Input, Spacer } from '@metorial/ui';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export type ProviderSessionFormProps =
  | {
      type: 'create';
      providerDeploymentId?: string;
      sessionTemplateId?: string;
      instanceId?: string;
    }
  | { type: 'update'; sessionId: string; instanceId?: string };

export let ProviderSessionForm = (
  props: ProviderSessionFormProps & {
    close?: () => void;
    onCreate?: (session: DashboardInstanceSessionsCreateOutput) => void;
  }
) => {
  let instance = useCurrentInstance();
  let instanceId = props.instanceId ?? instance.data?.id;
  let navigate = useNavigate();
  let createMutation = useCreateSession(instanceId);

  let [deploymentId, setDeploymentId] = useState(
    props.type === 'create' ? (props.providerDeploymentId ?? '') : ''
  );
  let form = useForm({
    initialValues: {
      name: '',
      description: ''
    },
    onSubmit: async values => {
      if (props.type !== 'create' || !instanceId) return;

      let providers = [];
      if (deploymentId) {
        providers.push({
          providerDeploymentId: deploymentId
        });
      }

      let [result] = await createMutation.mutate({
        name: values.name || undefined,
        description: values.description || undefined,
        providers
      });

      if (!result) return;

      if (props.onCreate) {
        props.onCreate(result);
        props.close?.();
        return;
      }

      props.close?.();
      if (!instance.data) return;

      navigate(
        Paths.instance.providerSession(
          instance.data.organization,
          instance.data.project,
          instance.data,
          result.id
        )
      );
    },
    schema: yup =>
      yup.object({
        name: yup.string().defined(),
        description: yup.string().defined()
      })
  });

  return (
    <form onSubmit={form.handleSubmit}>
      <Input label="Name (optional)" {...form.getFieldProps('name')} />
      <form.RenderError field="name" />

      <Spacer size={10} />

      <Input label="Description" {...form.getFieldProps('description')} />
      <form.RenderError field="description" />

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
        <Button type="button" variant="outline" onClick={props.close}>
          Cancel
        </Button>
        <Button type="submit" loading={createMutation.isPending}>
          {props.type === 'create' ? 'Create Session' : 'Update Session'}
        </Button>
      </Dialog.Actions>

      <createMutation.RenderError />
    </form>
  );
};
