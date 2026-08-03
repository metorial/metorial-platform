import { DashboardInstanceSkillsPluginsCreateOutput } from '@metorial/dashboard-sdk';
import { useForm } from '@metorial/data-hooks';
import { useCreateSkillPlugin } from '@metorial/state';
import { Button, Dialog, Input, Spacer } from '@metorial/ui';

export let SkillPluginForm = ({
  instanceId,
  close,
  onCreate
}: {
  instanceId: string;
  close?: () => void;
  onCreate?: (plugin: DashboardInstanceSkillsPluginsCreateOutput) => void;
}) => {
  let createMutation = useCreateSkillPlugin();
  let form = useForm({
    initialValues: {
      name: '',
      description: '',
      longDescription: '',
      category: ''
    },
    onSubmit: async values => {
      let [result] = await createMutation.mutate({
        instanceId,
        name: values.name.trim(),
        description: values.description.trim() || undefined,
        longDescription: values.longDescription.trim() || undefined,
        category: values.category.trim() || undefined
      });

      if (!result) return;

      onCreate?.(result);
      close?.();
    },
    schema: yup =>
      yup.object({
        name: yup.string().trim().required('Name is required'),
        description: yup.string(),
        longDescription: yup.string(),
        category: yup.string()
      })
  });

  return (
    <form onSubmit={form.handleSubmit}>
      <Input label="Name" required {...form.getFieldProps('name')} />
      <form.RenderError field="name" />

      <Spacer size={10} />

      <Input label="Description" {...form.getFieldProps('description')} />
      <form.RenderError field="description" />

      <Spacer size={10} />

      <Input
        label="Long description"
        as="textarea"
        minRows={4}
        {...form.getFieldProps('longDescription')}
      />
      <form.RenderError field="longDescription" />

      <Spacer size={10} />

      <Input label="Category" {...form.getFieldProps('category')} />
      <form.RenderError field="category" />

      <Spacer size={15} />

      <Dialog.Actions>
        <Button type="button" variant="soft" onClick={close}>
          Cancel
        </Button>
        <Button type="submit" loading={createMutation.isPending}>
          Create Plugin
        </Button>
      </Dialog.Actions>

      <createMutation.RenderError />
    </form>
  );
};
