import { DashboardInstanceConsumersCreateOutput } from '@metorial/dashboard-sdk';
import { useForm } from '@metorial/data-hooks';
import { useCreateConsumer, useCurrentInstance } from '@metorial/state';
import { Button, Dialog, Input, Spacer } from '@metorial/ui';

export let ConsumerForm = ({
  instanceId: instanceIdProp,
  close,
  onCreate
}: {
  instanceId?: string;
  close?: () => void;
  onCreate?: (consumer: DashboardInstanceConsumersCreateOutput) => void;
}) => {
  let instance = useCurrentInstance();
  let instanceId = instanceIdProp ?? instance.data?.id;
  let createMutation = useCreateConsumer();

  let form = useForm({
    initialValues: {
      name: '',
      email: ''
    },
    onSubmit: async values => {
      if (!instanceId) return;

      let [result] = await createMutation.mutate({
        instanceId,
        name: values.name.trim(),
        email: values.email.trim()
      });
      if (!result) return;

      onCreate?.(result);
      close?.();
    },
    schema: yup =>
      yup.object({
        name: yup.string().trim().required('Name is required'),
        email: yup.string().trim().email('Enter a valid email').required('Email is required')
      })
  });

  return (
    <form onSubmit={form.handleSubmit}>
      <Input label="Name" required {...form.getFieldProps('name')} />
      <form.RenderError field="name" />

      <Spacer size={10} />

      <Input label="Email" required {...form.getFieldProps('email')} />
      <form.RenderError field="email" />

      <createMutation.RenderError />

      <Spacer size={15} />

      <Dialog.Actions>
        <Button type="button" variant="outline" onClick={close} size="2">
          Cancel
        </Button>
        <Button type="submit" loading={createMutation.isLoading} size="2">
          Create Account
        </Button>
      </Dialog.Actions>
    </form>
  );
};
