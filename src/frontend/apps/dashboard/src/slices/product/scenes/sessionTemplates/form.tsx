import { useForm } from '@metorial/data-hooks';
import { useCreateSessionTemplate } from '@metorial/state';
import { Button, Dialog, Input, Spacer } from '@metorial/ui';

export type SessionTemplateFormProps =
  | { type: 'create'; instanceId: string }
  | { type: 'update'; templateId: string; instanceId: string };

export let SessionTemplateForm = (
  props: SessionTemplateFormProps & {
    close?: () => void;
    onCreate?: (template: any) => void;
  }
) => {
  let createMutation = useCreateSessionTemplate();
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

    if (props.type === 'create') {
      let [result] = await createMutation.mutate({
        instanceId: props.instanceId,
        name,
        description: form.values.description || undefined
      });

      if (!result) return;

      props.onCreate?.(result);
      props.close?.();
    }
  };

  return (
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

      <Spacer size={15} />

      <Dialog.Actions>
        <Button type="button" variant="outline" onClick={props.close}>
          Cancel
        </Button>
        <Button type="button" onClick={handleSubmit} loading={createMutation.isPending}>
          {props.type === 'create' ? 'Create' : 'Update'}
        </Button>
      </Dialog.Actions>

      <createMutation.RenderError />
    </form>
  );
};
