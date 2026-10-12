import type { DashboardInstanceProviderDeploymentsCreateOutput } from '@metorial/dashboard-sdk';
import { useForm } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import { useCreateProviderDeployment, useCurrentInstance } from '@metorial/state';
import { Button, Dialog, Input, Spacer, Text } from '@metorial/ui';
import { useNavigate } from 'react-router-dom';

export type ProviderDeploymentFormProps =
  | {
      type: 'create';
      instanceId?: string;
      providerId?: string;
      providerName?: string;
      lockedProviderVersionId?: string;
      lockedProviderVersionLabel?: string;
    }
  | { type: 'update'; deploymentId: string; instanceId?: string };

export let ProviderDeploymentForm = (
  props: ProviderDeploymentFormProps & {
    close?: () => void;
    onBack?: () => void;
    onCreate?: (deployment: DashboardInstanceProviderDeploymentsCreateOutput) => void;
  }
) => {
  let instance = useCurrentInstance();
  let instanceId = props.instanceId ?? instance.data?.id;
  let navigate = useNavigate();
  let createMutation = useCreateProviderDeployment();
  let providerId = props.type === 'create' ? props.providerId : undefined;

  let form = useForm({
    initialValues: {
      name: props.type === 'create' ? (props.providerName ?? '') : '',
      description: ''
    },
    onSubmit: async values => {
      if (props.type !== 'create' || !instanceId || !providerId) return;

      let [result] = await createMutation.mutate({
        instanceId,
        name: values.name.trim(),
        description: values.description || undefined,
        providerId,
        ...(props.lockedProviderVersionId
          ? { lockedProviderVersionId: props.lockedProviderVersionId }
          : {})
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
        Paths.instance.providerDeployment(
          instance.data.organization,
          instance.data.project,
          instance.data,
          result.id
        )
      );
    },
    schema: yup =>
      yup.object({
        name: yup.string().trim().required('Name is required'),
        description: yup.string()
      })
  });

  return (
    <form onSubmit={form.handleSubmit}>
      <Input label="Name" required {...form.getFieldProps('name')} />
      <form.RenderError field="name" />
      <Spacer size={10} />
      <Input label="Description" {...form.getFieldProps('description')} />
      <form.RenderError field="description" />

      {props.type === 'create' && props.lockedProviderVersionId && (
        <>
          <Spacer size={10} />
          <Text size="2" color="gray600">
            Pinned to version{' '}
            {props.lockedProviderVersionLabel ?? props.lockedProviderVersionId}
          </Text>
        </>
      )}

      <Spacer size={15} />
      <Dialog.Actions>
        <Button
          type="button"
          variant="outline"
          disabled={createMutation.isLoading}
          onClick={props.onBack ?? props.close}
        >
          {props.onBack ? 'Back' : 'Cancel'}
        </Button>
        <Button
          type="submit"
          loading={createMutation.isLoading}
          success={createMutation.isSuccess}
          disabled={!providerId}
        >
          Create
        </Button>
      </Dialog.Actions>
      <createMutation.RenderError />
    </form>
  );
};
