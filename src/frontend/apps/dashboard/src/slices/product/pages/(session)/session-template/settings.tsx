import { renderWithLoader, useForm } from '@metorial/data-hooks';
import { useCurrentInstance, useSessionTemplate } from '@metorial/state';
import { Button, Input, Spacer } from '@metorial/ui';
import { Box } from '@metorial/ui-product';
import { useParams } from 'react-router-dom';

export let SessionTemplateSettingsPage = () => {
  let instance = useCurrentInstance();

  let { sessionTemplateId } = useParams();
  let template = useSessionTemplate(instance.data?.id, sessionTemplateId);
  let updateMutator = template.useUpdateMutator();
  let form = useForm({
    initialValues: {
      name: template.data?.name ?? '',
      description: template.data?.description ?? ''
    },
    updateInitialValues: true,
    onSubmit: async values => {
      await updateMutator.mutate({
        name: values.name.trim(),
        description: values.description || undefined
      });
    },
    schema: yup =>
      yup.object({
        name: yup.string().trim().required('Name is required'),
        description: yup.string().ensure()
      })
  });

  return renderWithLoader({ template })(({ template }) => (
    <>
      <Box
        title="Template Settings"
        description="Modify the settings of this session template."
      >
        <form onSubmit={form.handleSubmit}>
          <Input label="Name" {...form.getFieldProps('name')} />
          <form.RenderError field="name" />

          <Spacer size={15} />

          <Input label="Description" {...form.getFieldProps('description')} />
          <form.RenderError field="description" />

          <Spacer size={15} />

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button
              size="2"
              type="submit"
              loading={updateMutator.isLoading}
              success={updateMutator.isSuccess}
            >
              Save
            </Button>
          </div>

          <updateMutator.RenderError />
        </form>
      </Box>
    </>
  ));
};
