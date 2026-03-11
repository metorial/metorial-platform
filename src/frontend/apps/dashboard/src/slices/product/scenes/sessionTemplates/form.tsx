import { DashboardInstanceSessionTemplatesCreateOutput } from '@metorial/dashboard-sdk';
import { useForm } from '@metorial/data-hooks';
import { useCreateSessionTemplate } from '@metorial/state';
import { Button, Dialog, Input, Spacer } from '@metorial/ui';

export type SessionTemplateFormProps =
  | { type: 'create'; instanceId: string }
  | { type: 'update'; templateId: string; instanceId: string };

export let SessionTemplateForm = (
  props: SessionTemplateFormProps & {
    close?: () => void;
    onCreate?: (template: DashboardInstanceSessionTemplatesCreateOutput) => void;
  }
) => {
  let createMutation = useCreateSessionTemplate();
  let form = useForm({
    initialValues: {
      name: '',
      description: ''
    },
    onSubmit: async values => {
      if (props.type === 'create') {
        let [result] = await createMutation.mutate({
          instanceId: props.instanceId,
          name: values.name.trim(),
          description: values.description || undefined
        });

        if (!result) return;

        props.onCreate?.(result);
        props.close?.();
      }
    },
    schema: yup =>
      yup.object({
        name: yup.string().trim().required('Name is required'),
        description: yup.string().defined()
      })
  });

  return (
    <form onSubmit={form.handleSubmit}>
      <Input label="Name" required {...form.getFieldProps('name')} />
      <form.RenderError field="name" />

      <Spacer size={10} />

      <Input label="Description" {...form.getFieldProps('description')} />
      <form.RenderError field="description" />

      <Spacer size={15} />

      <Dialog.Actions>
        <Button type="button" variant="outline" onClick={props.close}>
          Cancel
        </Button>
        <Button type="submit" loading={createMutation.isPending}>
          {props.type === 'create' ? 'Create' : 'Update'}
        </Button>
      </Dialog.Actions>

      <createMutation.RenderError />
    </form>
  );
};
