import { DashboardInstanceSkillsCreateOutput } from '@metorial/dashboard-sdk';
import { renderWithLoader, useForm } from '@metorial/data-hooks';
import { useCreateSkill, useSkillTemplates } from '@metorial/state';
import { Button, Dialog, Input, Select, Spacer } from '@metorial/ui';

export let SkillForm = ({
  instanceId,
  close,
  onCreate
}: {
  instanceId: string;
  close?: () => void;
  onCreate?: (skill: DashboardInstanceSkillsCreateOutput) => void;
}) => {
  let createMutation = useCreateSkill();
  let templates = useSkillTemplates(instanceId, { status: 'active', order: 'desc' });
  let form = useForm({
    initialValues: {
      name: '',
      description: '',
      templateId: ''
    },
    onSubmit: async values => {
      let [result] = await createMutation.mutate({
        instanceId,
        name: values.name.trim(),
        description: values.description.trim() || undefined,
        templateId: values.templateId || undefined
      });

      if (!result) return;

      onCreate?.(result);
      close?.();
    },
    schema: yup =>
      yup.object({
        name: yup.string().trim().required('Name is required'),
        description: yup.string(),
        templateId: yup.string()
      })
  });

  return renderWithLoader({ templates })(({ templates }) => (
    <form onSubmit={form.handleSubmit}>
      <Input label="Name" required {...form.getFieldProps('name')} />
      <form.RenderError field="name" />

      <Spacer size={10} />

      <Input label="Description" {...form.getFieldProps('description')} />
      <form.RenderError field="description" />

      {templates.data.items.length > 0 && (
        <>
          <Spacer size={10} />

          <Select
            label="Template"
            value={form.values.templateId || 'none'}
            onChange={value => form.setFieldValue('templateId', value == 'none' ? '' : value)}
            items={[
              { id: 'none', label: 'Start from scratch' },
              ...templates.data.items.map(template => ({
                id: template.id,
                label: template.name
              }))
            ]}
          />
        </>
      )}

      <Spacer size={15} />

      <Dialog.Actions>
        <Button type="button" variant="soft" onClick={close}>
          Cancel
        </Button>
        <Button type="submit" loading={createMutation.isPending}>
          Create Skill
        </Button>
      </Dialog.Actions>

      <createMutation.RenderError />
    </form>
  ));
};
