import { DashboardInstanceSkillsGroupsCreateOutput } from '@metorial/dashboard-sdk';
import { useForm } from '@metorial/data-hooks';
import { useCreateSkillGroup } from '@metorial/state';
import { Button, Dialog, Input, Spacer } from '@metorial/ui';

export let SkillGroupForm = ({
  instanceId,
  close,
  onCreate
}: {
  instanceId: string;
  close?: () => void;
  onCreate?: (skillGroup: DashboardInstanceSkillsGroupsCreateOutput) => void;
}) => {
  let createMutation = useCreateSkillGroup();
  let form = useForm({
    initialValues: {
      name: '',
      description: ''
    },
    onSubmit: async values => {
      let [result] = await createMutation.mutate({
        instanceId,
        name: values.name.trim(),
        description: values.description.trim() || undefined
      });

      if (!result) return;

      onCreate?.(result);
      close?.();
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

      <Spacer size={15} />

      <Dialog.Actions>
        <Button type="button" variant="outline" onClick={close}>
          Cancel
        </Button>
        <Button type="submit" loading={createMutation.isPending}>
          Create Group
        </Button>
      </Dialog.Actions>

      <createMutation.RenderError />
    </form>
  );
};
