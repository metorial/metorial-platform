import { DashboardInstanceIdentitiesCreateOutput } from '@metorial/dashboard-sdk';
import { useForm } from '@metorial/data-hooks';
import { useCreateIdentity, useCurrentInstance } from '@metorial/state';
import { Button, Dialog, Input, Spacer } from '@metorial/ui';

export let IdentityForm = ({
  instanceId: instanceIdProp,
  actorId,
  close,
  onCreate
}: {
  instanceId?: string;
  actorId: string;
  close?: () => void;
  onCreate?: (identity: DashboardInstanceIdentitiesCreateOutput) => void;
}) => {
  let instance = useCurrentInstance();
  let instanceId = instanceIdProp ?? instance.data?.id;
  let createMutation = useCreateIdentity();

  let form = useForm({
    initialValues: {
      name: '',
      description: ''
    },
    onSubmit: async values => {
      if (!instanceId) return;

      let [result] = await createMutation.mutate({
        instanceId,
        actorId,
        name: values.name.trim() || undefined,
        description: values.description.trim() || undefined
      });

      if (!result) return;

      onCreate?.(result);
      close?.();
    },
    schema: yup =>
      yup.object({
        name: yup.string().ensure(),
        description: yup.string().ensure()
      })
  });

  return (
    <form onSubmit={form.handleSubmit}>
      <Input label="Name" placeholder="Primary Identity" {...form.getFieldProps('name')} />
      <form.RenderError field="name" />

      <Spacer size={10} />

      <Input
        label="Description"
        placeholder="Short description"
        {...form.getFieldProps('description')}
      />
      <form.RenderError field="description" />

      <createMutation.RenderError />

      <Spacer size={15} />

      <Dialog.Actions>
        <Button type="button" variant="outline" onClick={close} size="2">
          Cancel
        </Button>
        <Button type="submit" loading={createMutation.isLoading} size="2">
          Create Identity
        </Button>
      </Dialog.Actions>
    </form>
  );
};
