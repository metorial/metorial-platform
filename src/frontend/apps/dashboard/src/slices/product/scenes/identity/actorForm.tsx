import { DashboardInstanceIdentityActorsCreateOutput } from '@metorial/dashboard-sdk';
import { useForm } from '@metorial/data-hooks';
import { useCreateIdentityActor, useCurrentInstance } from '@metorial/state';
import { Button, Dialog, Input, Select, Spacer } from '@metorial/ui';

export let IdentityActorForm = ({
  instanceId: instanceIdProp,
  close,
  onCreate
}: {
  instanceId?: string;
  close?: () => void;
  onCreate?: (actor: DashboardInstanceIdentityActorsCreateOutput) => void;
}) => {
  let instance = useCurrentInstance();
  let instanceId = instanceIdProp ?? instance.data?.id;
  let createMutation = useCreateIdentityActor();

  let form = useForm({
    initialValues: {
      type: 'person' as 'person' | 'agent',
      name: '',
      description: ''
    },
    onSubmit: async values => {
      if (!instanceId) return;

      let [result] = await createMutation.mutate({
        instanceId,
        type: values.type,
        name: values.name.trim(),
        description: values.description.trim() || undefined
      });

      if (!result) return;

      onCreate?.(result);
      close?.();
    },
    schema: yup =>
      yup.object({
        type: yup.string().oneOf(['person', 'agent']).required('Type is required'),
        name: yup.string().trim().required('Name is required'),
        description: yup.string().ensure()
      })
  });

  return (
    <form onSubmit={form.handleSubmit}>
      <Select
        label="Type"
        value={form.values.type}
        onChange={value => form.setFieldValue('type', value)}
        items={[
          {
            id: 'person',
            label: 'Person'
          },
          {
            id: 'agent',
            label: 'Agent'
          }
        ]}
      />
      <form.RenderError field="type" />

      <Spacer size={10} />

      <Input
        label="Name"
        required
        placeholder="Support Agent"
        {...form.getFieldProps('name')}
      />
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
        <Button type="button" variant="outline" onClick={close}>
          Cancel
        </Button>
        <Button type="submit" loading={createMutation.isLoading}>
          Create Actor
        </Button>
      </Dialog.Actions>
    </form>
  );
};
